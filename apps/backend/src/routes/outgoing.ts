import { Router } from "express";
import { db } from "../db/index.js";
import {
  item,
  outgoingTransaction,
  outgoingTransactionItem,
  activityLog,
  category,
  itemType,
  warehouse,
} from "../db/schema.js";
import { eq, and, sql, desc, gte, lte, or, ilike } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/outgoing/next-code
 * Generates the next sequential transaction code (e.g. KB-00057)
 */
router.get("/next-code", async (req, res) => {
  try {
    const userId = req.user!.id;
    // Find the latest transaction code
    const latestTx = await db
      .select({ transactionCode: outgoingTransaction.transactionCode })
      .from(outgoingTransaction)
      .where(eq(outgoingTransaction.createdById, userId))
      .orderBy(desc(outgoingTransaction.id))
      .limit(1);

    let nextNum = 1;
    if (latestTx.length > 0 && latestTx[0].transactionCode) {
      const match = latestTx[0].transactionCode.match(/KB-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    const nextCode = `KB-${String(nextNum).padStart(5, "0")}`;
    res.json({ code: nextCode });
  } catch (error) {
    console.error("Generate next code error:", error);
    res.status(500).json({ error: "Gagal membuat kode transaksi" });
  }
});

/**
 * POST /api/outgoing
 * Creates a new outgoing transaction
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { date, items: reqItems } = req.body;

    if (!reqItems || !Array.isArray(reqItems) || reqItems.length === 0) {
      res.status(400).json({ error: "Daftar barang tidak boleh kosong" });
      return;
    }

    // Validate date
    const txDate = date ? new Date(date) : new Date();

    // Verify all items belong to user and have enough stock
    for (const reqItem of reqItems) {
      const { itemId, quantity } = reqItem;
      if (!itemId || !quantity || quantity <= 0) {
        res.status(400).json({ error: "ID barang dan jumlah yang valid wajib diisi" });
        return;
      }

      const dbItem = await db.query.item.findFirst({
        where: and(eq(item.id, itemId), eq(item.createdById, userId)),
      });

      if (!dbItem) {
        res.status(404).json({ error: `Barang dengan ID ${itemId} tidak ditemukan` });
        return;
      }

      if (dbItem.quantity < quantity) {
        res.status(400).json({
          error: `Stok untuk "${dbItem.name}" tidak mencukupi. Tersedia: ${dbItem.quantity} Pcs, diminta: ${quantity} Pcs.`,
        });
        return;
      }
    }

    // Process transaction
    const result = await db.transaction(async (tx) => {
      // 1. Generate code
      const latestTx = await tx
        .select({ transactionCode: outgoingTransaction.transactionCode })
        .from(outgoingTransaction)
        .where(eq(outgoingTransaction.createdById, userId))
        .orderBy(desc(outgoingTransaction.id))
        .limit(1);

      let nextNum = 1;
      if (latestTx.length > 0 && latestTx[0].transactionCode) {
        const match = latestTx[0].transactionCode.match(/KB-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      const transactionCode = `KB-${String(nextNum).padStart(5, "0")}`;

      // 2. Insert outgoing transaction header
      const [newTx] = await tx
        .insert(outgoingTransaction)
        .values({
          transactionCode,
          date: txDate,
          createdById: userId,
        })
        .returning();

      // 3. Process each item
      for (const reqItem of reqItems) {
        const { itemId, quantity } = reqItem;

        // Fetch current item state in transaction
        const dbItem = await tx.query.item.findFirst({
          where: eq(item.id, itemId),
        });
        if (!dbItem) throw new Error("Barang tidak ditemukan di tengah transaksi");

        const nextQty = dbItem.quantity - quantity;

        // Determine status
        let status = "AMAN";
        if (nextQty <= 0) status = "KRITIS";
        else if (nextQty <= 20) status = "KRITIS";
        else if (nextQty <= 50) status = "MENIPIS";

        // Insert outgoing item detail
        await tx.insert(outgoingTransactionItem).values({
          transactionId: newTx.id,
          itemId,
          quantity,
          unit: "Pcs",
        });

        // Update item quantity
        await tx
          .update(item)
          .set({
            quantity: nextQty,
            status,
            updatedAt: new Date(),
          })
          .where(eq(item.id, itemId));

        // Insert activity log
        await tx.insert(activityLog).values({
          type: "KELUAR",
          itemId,
          warehouseId: dbItem.warehouseId,
          outgoingTransactionId: newTx.id,
          quantity,
          createdById: userId,
          createdAt: txDate,
        });
      }

      return newTx;
    });

    res.status(201).json({ success: true, transaction: result });
  } catch (error: any) {
    console.error("Create outgoing transaction error:", error);
    res.status(500).json({ error: error.message || "Gagal menyimpan transaksi keluar" });
  }
});

/**
 * GET /api/outgoing/history
 * Returns merged MASUK & KELUAR activity log history with search and filters
 */
router.get("/history", async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;

    const dateFromStr = req.query.dateFrom as string | undefined;
    const dateToStr = req.query.dateTo as string | undefined;
    const filterType = req.query.type as string | undefined; // Semua, MASUK, KELUAR
    const search = req.query.search as string | undefined;

    // Filter by user and logs of interest (MASUK & KELUAR)
    const conditions = [
      eq(activityLog.createdById, userId),
      or(eq(activityLog.type, "MASUK"), eq(activityLog.type, "KELUAR")),
    ];

    if (dateFromStr) {
      conditions.push(gte(activityLog.createdAt, new Date(dateFromStr)));
    }
    if (dateToStr) {
      const toDate = new Date(dateToStr);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(activityLog.createdAt, toDate));
    }

    if (filterType && filterType !== "Semua") {
      conditions.push(eq(activityLog.type, filterType));
    }

    // Join search query on item code/name or transaction code
    if (search) {
      conditions.push(
        or(
          ilike(item.name, `%${search}%`),
          ilike(item.code, `%${search}%`),
          ilike(outgoingTransaction.transactionCode, `%${search}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .leftJoin(item, eq(activityLog.itemId, item.id))
      .leftJoin(outgoingTransaction, eq(activityLog.outgoingTransactionId, outgoingTransaction.id))
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    // Fetch details
    const logs = await db
      .select({
        id: activityLog.id,
        type: activityLog.type,
        quantity: activityLog.quantity,
        createdAt: activityLog.createdAt,
        itemId: activityLog.itemId,
        itemName: item.name,
        itemCode: item.code,
        remainingStock: item.quantity, // current stock of the item
        transactionCode: outgoingTransaction.transactionCode,
      })
      .from(activityLog)
      .leftJoin(item, eq(activityLog.itemId, item.id))
      .leftJoin(outgoingTransaction, eq(activityLog.outgoingTransactionId, outgoingTransaction.id))
      .where(whereClause)
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(limit)
      .offset(offset);

    // Format logs for response
    const data = logs.map(log => {
      // If MASUK and no transaction code, it is an initial entry
      const txCode = log.type === "MASUK"
        ? (log.transactionCode || "MASUK-BARU")
        : (log.transactionCode || "KB-UNKNOWN");

      return {
        id: log.id,
        date: log.createdAt,
        transactionCode: txCode,
        type: log.type,
        itemName: log.itemName || "Barang Dihapus",
        itemCode: log.itemCode || "-",
        quantity: log.type === "KELUAR" ? -log.quantity : log.quantity,
        unit: "Pcs",
        remainingStock: log.remainingStock ?? 0,
      };
    });

    res.json({
      history: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get activity log history error:", error);
    res.status(500).json({ error: "Gagal memuat riwayat keluar masuk barang" });
  }
});

export default router;
