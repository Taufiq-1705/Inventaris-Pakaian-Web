import { Router } from "express";
import { db } from "../db/index.js";
import { item, warehouse, activityLog, category } from "../db/schema.js";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// All dashboard routes require authentication
router.use(requireAuth);

/**
 * GET /api/dashboard/stats
 * Returns KPI data: total item types, total stock, per-warehouse stats
 */
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user!.id;

    // Total distinct items (jenis barang) — scoped to user
    const totalItemsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(item)
      .where(eq(item.createdById, userId));
    const totalItems = Number(totalItemsResult[0]?.count ?? 0);

    // Total stock across all items — scoped to user
    const totalStockResult = await db
      .select({ total: sql<number>`coalesce(sum(${item.quantity}), 0)` })
      .from(item)
      .where(eq(item.createdById, userId));
    const totalStock = Number(totalStockResult[0]?.total ?? 0);

    // Per-warehouse stats
    const warehouses = await db.select().from(warehouse);
    const warehouseStats = await Promise.all(
      warehouses.map(async (w) => {
        const stockResult = await db
          .select({
            currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)`,
          })
          .from(item)
          .where(and(eq(item.warehouseId, w.id), eq(item.createdById, userId)));

        const currentStock = Number(stockResult[0]?.currentStock ?? 0);
        const percentage =
          w.maxCapacity > 0
            ? Math.round((currentStock / w.maxCapacity) * 100)
            : 0;

        return {
          id: w.id,
          name: w.name,
          description: w.description,
          locationLabel: w.locationLabel,
          maxCapacity: w.maxCapacity,
          currentStock,
          percentage,
        };
      })
    );

    res.json({
      totalItems,
      totalStock,
      warehouses: warehouseStats,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Gagal memuat data dashboard" });
  }
});

/**
 * GET /api/dashboard/activity-chart
 * Returns bar chart data: masuk vs keluar per day (last 7 days)
 */
router.get("/activity-chart", async (req, res) => {
  try {
    const userId = req.user!.id;
    const timeframe = req.query.timeframe === "month" ? "month" : "week";
    const daysCount = timeframe === "month" ? 30 : 7;

    if (timeframe === "week") {
      // WEEK TIMEFRAME: Group by day for the last 7 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7 + 1);
      startDate.setHours(0, 0, 0, 0);

      const dbLogs = await db
        .select({
          dateStr: sql<string>`${activityLog.createdAt}::date::text`,
          type: activityLog.type,
          totalQty: sql<number>`sum(${activityLog.quantity})::integer`,
        })
        .from(activityLog)
        .where(
          and(
            gte(activityLog.createdAt, startDate),
            eq(activityLog.createdById, userId)
          )
        )
        .groupBy(sql`${activityLog.createdAt}::date`, activityLog.type);

      const logMap = new Map<string, number>();
      for (const log of dbLogs) {
        if (log.dateStr) {
          logMap.set(`${log.dateStr}_${log.type}`, Number(log.totalQty || 0));
        }
      }

      const chartData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        const label = date.toLocaleDateString("id-ID", { weekday: "short" }).toUpperCase();
        const masuk = logMap.get(`${dateStr}_MASUK`) ?? 0;
        const keluar = logMap.get(`${dateStr}_KELUAR`) ?? 0;

        chartData.push({
          day: label,
          date: dateStr,
          masuk,
          keluar,
        });
      }

      res.json({ data: chartData });
    } else {
      // MONTH TIMEFRAME: Group by month for the last 6 months
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 5); // 6 months total including current month
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const dbLogs = await db
        .select({
          monthStr: sql<string>`to_char(${activityLog.createdAt}, 'YYYY-MM')`,
          type: activityLog.type,
          totalQty: sql<number>`sum(${activityLog.quantity})::integer`,
        })
        .from(activityLog)
        .where(
          and(
            gte(activityLog.createdAt, startDate),
            eq(activityLog.createdById, userId)
          )
        )
        .groupBy(sql`to_char(${activityLog.createdAt}, 'YYYY-MM')`, activityLog.type);

      const logMap = new Map<string, number>();
      for (const log of dbLogs) {
        if (log.monthStr) {
          logMap.set(`${log.monthStr}_${log.type}`, Number(log.totalQty || 0));
        }
      }

      const chartData = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date(startDate);
        date.setMonth(startDate.getMonth() + i);

        const year = date.getFullYear();
        const monthNum = String(date.getMonth() + 1).padStart(2, "0");
        const monthStr = `${year}-${monthNum}`;

        const label = date.toLocaleDateString("id-ID", { month: "long" });
        const masuk = logMap.get(`${monthStr}_MASUK`) ?? 0;
        const keluar = logMap.get(`${monthStr}_KELUAR`) ?? 0;

        chartData.push({
          day: label, // e.g. "Juli", "Agustus"
          date: monthStr,
          masuk,
          keluar,
        });
      }

      res.json({ data: chartData });
    }
  } catch (error) {
    console.error("Activity chart error:", error);
    res.status(500).json({ error: "Gagal memuat data chart" });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Returns recent activity log entries with item details
 * Query: ?limit=20 (default 5, max 50)
 */
router.get("/recent-activity", async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 5));

    const activities = await db.query.activityLog.findMany({
      where: eq(activityLog.createdById, userId),
      orderBy: [desc(activityLog.createdAt)],
      limit,
      with: {
        item: true,
        warehouse: true,
      },
    });

    res.json({
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        itemName: a.item?.name ?? "Unknown",
        itemCode: a.item?.code ?? "N/A",
        warehouseName: a.warehouse?.name ?? "N/A",
        quantity: a.quantity,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Recent activity error:", error);
    res.status(500).json({ error: "Gagal memuat aktivitas terbaru" });
  }
});

export default router;
