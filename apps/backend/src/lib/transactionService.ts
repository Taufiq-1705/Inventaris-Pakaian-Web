import { item, outgoingTransaction, outgoingTransactionItem, activityLog } from "../db/schema.js";
import { eq, and, inArray, sql } from "drizzle-orm";
import { calculateStockStatus, formatTransactionCode } from "./businessRules.js";

export interface OutgoingItemRequest {
  itemId: number;
  quantity: number;
}

export interface OutgoingPayload {
  date?: string | Date;
  items: OutgoingItemRequest[];
}

export interface TransactionServiceResult {
  transactionCode: string;
  transactionId: number;
  itemsProcessed: number;
  transaction: any;
}

export class TransactionValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "TransactionValidationError";
    this.statusCode = statusCode;
  }
}

/** Pesan error stok tidak cukup â€” dipakai di pre-check maupun re-validasi di dalam transaksi. */
function insufficientStockMessage(name: string, available: number, requested: number): string {
  return `Stok untuk "${name}" tidak mencukupi. Tersedia: ${available} Pcs, diminta: ${requested} Pcs.`;
}

/**
 * Memproses transaksi keluar barang secara atomik (ACID):
 * 1. Validasi input awal (empty check, non-positive quantity)
 * 2. Konsolidasi baris dengan itemId yang sama (total kuantitas per barang)
 * 3. Pre-check cepat di luar transaksi: bulk query via inArray + Hash Map O(1)
 * 4. Eksekusi db.transaction:
 *    a. Kunci baris barang (SELECT ... FOR UPDATE) & validasi ulang stok
 *    b. Generate nomor serial transaksi KB-XXXXX (Atomic sequence)
 *    c. Insert header outgoingTransaction
 *    d. Batch insert outgoingTransactionItem, batch update stok, batch insert activityLog
 */
export async function executeOutgoingTransaction(
  dbInstance: any,
  userId: string,
  payload: OutgoingPayload
): Promise<TransactionServiceResult> {
  const { date, items: reqItems } = payload;

  if (!reqItems || !Array.isArray(reqItems) || reqItems.length === 0) {
    throw new TransactionValidationError("Daftar barang tidak boleh kosong", 400);
  }

  // 1. Validasi masukan dasar untuk setiap item (wajib integer positif)
  for (const reqItem of reqItems) {
    const { itemId, quantity } = reqItem;
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new TransactionValidationError("ID barang dan jumlah yang valid wajib diisi", 400);
    }
  }

  // 2. Konsolidasi: baris dengan itemId sama dijumlahkan agar stok divalidasi
  //    terhadap TOTAL permintaan, bukan per baris (mencegah oversell).
  const requested = new Map<number, number>();
  for (const { itemId, quantity } of reqItems) {
    requested.set(itemId, (requested.get(itemId) ?? 0) + quantity);
  }
  const itemIds = [...requested.keys()];

  // 3. Pre-check cepat di luar transaksi (fail-fast tanpa membuka transaksi DB)
  let dbItems: any[] = [];

  if (typeof dbInstance.query?.item?.findMany === "function") {
    dbItems = await dbInstance.query.item.findMany({
      where: and(inArray(item.id, itemIds), eq(item.createdById, userId)),
    });
  } else if (typeof dbInstance.query?.item?.findFirst === "function") {
    // Fallback kompatibilitas jika environment mock hanya menyediakan findFirst
    for (const id of itemIds) {
      const it = await dbInstance.query.item.findFirst({
        where: and(eq(item.id, id), eq(item.createdById, userId)),
      });
      if (it) dbItems.push(it);
    }
  }

  // Map untuk lookup O(1) di memori
  const itemMap = new Map<number, any>(dbItems.map((it: any) => [it.id, it]));

  for (const [itemId, quantity] of requested) {
    const dbItem = itemMap.get(itemId);

    if (!dbItem) {
      throw new TransactionValidationError(`Barang dengan ID ${itemId} tidak ditemukan`, 404);
    }

    if (dbItem.quantity < quantity) {
      throw new TransactionValidationError(
        insufficientStockMessage(dbItem.name, dbItem.quantity, quantity),
        400
      );
    }
  }

  const txDate = date ? new Date(date) : new Date();

  // 4. Eksekusi transaksi atomik (ACID)
  return await dbInstance.transaction(async (tx: any) => {
    // a. Kunci baris barang sampai COMMIT/ROLLBACK agar transaksi konkuren tidak
    //    bisa mengubah stok di antara validasi dan update (mencegah TOCTOU).
    //    ORDER BY id menjamin urutan penguncian konsisten -> menghindari deadlock.
    const lockedItems: any[] = await tx
      .select()
      .from(item)
      .where(and(inArray(item.id, itemIds), eq(item.createdById, userId)))
      .orderBy(item.id)
      .for("update");

    const lockedMap = new Map<number, any>(lockedItems.map((it: any) => [it.id, it]));
    const stockUpdates: Array<{ id: number; quantity: number; status: string }> = [];
    const lines: Array<{ itemId: number; quantity: number; warehouseId: number }> = [];

    for (const [itemId, quantity] of requested) {
      const dbItem = lockedMap.get(itemId);

      if (!dbItem) {
        throw new Error("Barang tidak ditemukan di tengah transaksi");
      }

      // Validasi ulang terhadap snapshot yang sudah terkunci
      if (dbItem.quantity < quantity) {
        throw new TransactionValidationError(
          insufficientStockMessage(dbItem.name, dbItem.quantity, quantity),
          400
        );
      }

      const nextQty = dbItem.quantity - quantity;
      stockUpdates.push({ id: itemId, quantity: nextQty, status: calculateStockStatus(nextQty) });
      lines.push({ itemId, quantity, warehouseId: dbItem.warehouseId });
    }

    // b. Penomoran serial kode transaksi thread-safe via sequence Postgres.
    //    Tidak ada fallback: bila nextval() gagal, Postgres sudah membatalkan
    //    transaksi (status aborted) sehingga query lanjutan apa pun pasti gagal.
    //    Error dibiarkan naik -> ROLLBACK -> HTTP 500.
    const [seqRow] = await tx.execute(sql`SELECT nextval('outgoing_tx_seq') AS next_val`);
    const transactionCode = formatTransactionCode(Number(seqRow.next_val), "KB");

    // c. Insert header transaksi
    const [newTx] = await tx
      .insert(outgoingTransaction)
      .values({
        transactionCode,
        date: txDate,
        createdById: userId,
      })
      .returning();

    // d. Batch Insert Detail Items (1 Query Batch). `lines` selalu berisi >= 1
    //    baris karena reqItems tidak kosong dan setiap iterasi push atau throw.
    await tx.insert(outgoingTransactionItem).values(
      lines.map((l) => ({
        transactionId: newTx.id,
        itemId: l.itemId,
        quantity: l.quantity,
        unit: "Pcs",
      }))
    );

    // e. Batch Update Stok Barang (1 Query): CASE per id, bukan 1 UPDATE per barang.
    //    ::integer wajib karena parameter di cabang THEN tidak bertipe (default text).
    const whenQty = stockUpdates.map((u) => sql`WHEN ${u.id} THEN ${u.quantity}::integer`);
    const whenStatus = stockUpdates.map((u) => sql`WHEN ${u.id} THEN ${u.status}`);

    await tx
      .update(item)
      .set({
        quantity: sql`CASE ${item.id} ${sql.join(whenQty, sql` `)} END`,
        status: sql`CASE ${item.id} ${sql.join(whenStatus, sql` `)} END`,
        updatedAt: new Date(),
      })
      .where(inArray(item.id, stockUpdates.map((u) => u.id)));

    // f. Batch Insert Activity Logs (1 Query Batch)
    await tx.insert(activityLog).values(
      lines.map((l) => ({
        type: "KELUAR",
        itemId: l.itemId,
        warehouseId: l.warehouseId,
        outgoingTransactionId: newTx.id,
        quantity: l.quantity,
        createdById: userId,
        createdAt: txDate,
      }))
    );

    return {
      transactionCode,
      transactionId: newTx.id,
      itemsProcessed: lines.length,
      transaction: newTx,
    };
  });
}
