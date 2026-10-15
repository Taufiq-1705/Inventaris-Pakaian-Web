import { item, outgoingTransaction, outgoingTransactionItem, activityLog } from "../db/schema.js";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
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

/**
 * Memproses transaksi keluar barang secara atomik (ACID):
 * 1. Validasi input awal (empty check, non-positive quantity)
 * 2. Bulk query items via inArray & Hash Map lookup O(1) untuk eliminasi N+1 query
 * 3. Eksekusi db.transaction:
 *    a. Generate nomor serial transaksi KB-XXXXX (Atomic sequence / fallback)
 *    b. Insert header outgoingTransaction
 *    c. Batch insert outgoingTransactionItem & activityLog
 *    d. Update stok & status barang
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

  // 1. Validasi masukan dasar untuk setiap item
  for (const reqItem of reqItems) {
    const { itemId, quantity } = reqItem;
    if (!itemId || quantity === undefined || quantity === null || quantity <= 0) {
      throw new TransactionValidationError("ID barang dan jumlah yang valid wajib diisi", 400);
    }
  }

  // 2. Eliminasi N+1 Query: Bulk Fetch seluruh item terkait dalam 1 query
  const itemIds = [...new Set(reqItems.map((i) => i.itemId))];
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

  // Validasi ketersediaan dan kecukupan stok secara in-memory (O(N) CPU operations)
  for (const reqItem of reqItems) {
    const { itemId, quantity } = reqItem;
    const dbItem = itemMap.get(itemId);

    if (!dbItem) {
      throw new TransactionValidationError(`Barang dengan ID ${itemId} tidak ditemukan`, 404);
    }

    if (dbItem.quantity < quantity) {
      throw new TransactionValidationError(
        `Stok untuk "${dbItem.name}" tidak mencukupi. Tersedia: ${dbItem.quantity} Pcs, diminta: ${quantity} Pcs.`,
        400
      );
    }
  }

  const txDate = date ? new Date(date) : new Date();

  // 3. Eksekusi transaksi atomik (ACID)
  return await dbInstance.transaction(async (tx: any) => {
    // a. Penomoran serial kode transaksi thread-safe
    let transactionCode = "";
    if (typeof tx.execute === "function") {
      try {
        const seqResult = await tx.execute(sql`SELECT nextval('outgoing_tx_seq') AS next_val`);
        const nextVal = seqResult?.rows?.[0]?.next_val ?? seqResult?.[0]?.next_val;
        if (nextVal !== undefined && nextVal !== null) {
          transactionCode = formatTransactionCode(Number(nextVal), "KB");
        }
      } catch (_seqErr) {
        // Fallback jika sequence belum dibuat di database atau environment mock
      }
    }

    if (!transactionCode) {
      const latestTx = await tx
        .select({ transactionCode: outgoingTransaction.transactionCode })
        .from(outgoingTransaction)
        .where(eq(outgoingTransaction.createdById, userId))
        .orderBy(desc(outgoingTransaction.id))
        .limit(1);

      let nextNum = 1;
      if (latestTx.length > 0 && latestTx[0].transactionCode) {
        const match = latestTx[0].transactionCode.match(/KB-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      transactionCode = formatTransactionCode(nextNum, "KB");
    }

    // b. Insert header transaksi
    const [newTx] = await tx
      .insert(outgoingTransaction)
      .values({
        transactionCode,
        date: txDate,
        createdById: userId,
      })
      .returning();

    // c. Verifikasi item di dalam transaksi & siapkan batch writes
    let txDbItems: any[] = [];
    if (typeof tx.query?.item?.findMany === "function") {
      txDbItems = await tx.query.item.findMany({
        where: inArray(item.id, itemIds),
      });
    } else if (typeof tx.query?.item?.findFirst === "function") {
      for (const id of itemIds) {
        const it = await tx.query.item.findFirst({
          where: eq(item.id, id),
        });
        if (it) txDbItems.push(it);
      }
    }

    const txItemMap = new Map<number, any>(txDbItems.map((it: any) => [it.id, it]));

    const itemsToInsert: any[] = [];
    const logsToInsert: any[] = [];
    const stockUpdates: Array<{ id: number; quantity: number; status: string }> = [];

    for (const reqItem of reqItems) {
      const { itemId, quantity } = reqItem;
      const dbItem = txItemMap.get(itemId);

      if (!dbItem) {
        throw new Error("Barang tidak ditemukan di tengah transaksi");
      }

      const nextQty = dbItem.quantity - quantity;
      const status = calculateStockStatus(nextQty);

      itemsToInsert.push({
        transactionId: newTx.id,
        itemId,
        quantity,
        unit: "Pcs",
      });

      logsToInsert.push({
        type: "KELUAR",
        itemId,
        warehouseId: dbItem.warehouseId,
        outgoingTransactionId: newTx.id,
        quantity,
        createdById: userId,
        createdAt: txDate,
      });

      stockUpdates.push({
        id: itemId,
        quantity: nextQty,
        status,
      });
    }

    // d. Batch Insert Detail Items (1 Query Batch)
    if (itemsToInsert.length > 0) {
      await tx.insert(outgoingTransactionItem).values(itemsToInsert);
    }

    // e. Batch Update Stok Barang
    for (const up of stockUpdates) {
      await tx
        .update(item)
        .set({
          quantity: up.quantity,
          status: up.status,
          updatedAt: new Date(),
        })
        .where(eq(item.id, up.id));
    }

    // f. Batch Insert Activity Logs (1 Query Batch)
    if (logsToInsert.length > 0) {
      await tx.insert(activityLog).values(logsToInsert);
    }

    return {
      transactionCode,
      transactionId: newTx.id,
      itemsProcessed: reqItems.length,
      transaction: newTx,
    };
  });
}

