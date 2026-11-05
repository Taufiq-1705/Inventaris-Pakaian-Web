import { Router } from "express";
import { db } from "../db/index.js";
import {
  item,
  outgoingTransaction,
  activityLog,
} from "../db/schema.js";
import { eq, and, sql, desc, gte, lte, or, ilike } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import {
  executeOutgoingTransaction,
  TransactionValidationError,
} from "../lib/transactionService.js";

const router = Router();

router.use(requireAuth);

// Catatan: tidak ada endpoint "preview kode berikutnya". Kode KB-XXXXX diambil
// dari sequence Postgres saat transaksi disimpan, sehingga nilai pratinjau apa
// pun tidak dijamin sama. Kode final dikembalikan oleh POST /api/outgoing.

/**
 * POST /api/outgoing
 * Creates a new outgoing transaction
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { transaction } = await executeOutgoingTransaction(db, userId, req.body);
    res.status(201).json({ success: true, transaction });
  } catch (error: any) {
    if (error instanceof TransactionValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
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

    // Count & data tidak saling bergantung -> jalankan paralel (1 round-trip efektif)
    const [countResult, logs] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLog)
        .leftJoin(item, eq(activityLog.itemId, item.id))
        .leftJoin(outgoingTransaction, eq(activityLog.outgoingTransactionId, outgoingTransaction.id))
        .where(whereClause),
      db
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
        .offset(offset),
    ]);
    const total = Number(countResult[0]?.count ?? 0);

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
