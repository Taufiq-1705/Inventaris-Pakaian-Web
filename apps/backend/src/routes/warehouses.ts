import { Router } from "express";
import { db } from "../db/index.js";
import { warehouse, item } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/warehouses
 * List all warehouses with computed current stock and capacity percentage
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const warehouses = await db.select().from(warehouse);

    const result = await Promise.all(
      warehouses.map(async (w) => {
        const stockResult = await db
          .select({
            currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)`,
            itemCount: sql<number>`count(*)`,
          })
          .from(item)
          .where(and(eq(item.warehouseId, w.id), eq(item.createdById, userId)));

        const currentStock = Number(stockResult[0]?.currentStock ?? 0);
        const itemCount = Number(stockResult[0]?.itemCount ?? 0);
        const percentage =
          w.maxCapacity > 0
            ? Math.round((currentStock / w.maxCapacity) * 100)
            : 0;

        // Determine status label
        let status = "STABIL";
        if (percentage >= 95) status = "KAPASITAS KRITIS";
        else if (percentage >= 80) status = "ZONA PERINGATAN";

        return {
          id: w.id,
          name: w.name,
          description: w.description,
          locationLabel: w.locationLabel,
          maxCapacity: w.maxCapacity,
          allowedCategoryId: w.allowedCategoryId,
          currentStock,
          itemCount,
          percentage,
          status,
        };
      })
    );

    res.json({ warehouses: result });
  } catch (error) {
    console.error("List warehouses error:", error);
    res.status(500).json({ error: "Gagal memuat data gudang" });
  }
});

/**
 * GET /api/warehouses/:id
 * Get a single warehouse with detailed capacity breakdown
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tidak valid" });
      return;
    }

    const w = await db.query.warehouse.findFirst({
      where: eq(warehouse.id, id),
    });

    if (!w) {
      res.status(404).json({ error: "Gudang tidak ditemukan" });
      return;
    }

    // Get items in this warehouse (scoped to user)
    const userId = req.user!.id;
    const items = await db
      .select({
        currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)`,
        itemCount: sql<number>`count(*)`,
      })
      .from(item)
      .where(and(eq(item.warehouseId, id), eq(item.createdById, userId)));

    const currentStock = Number(items[0]?.currentStock ?? 0);
    const itemCount = Number(items[0]?.itemCount ?? 0);
    const percentage =
      w.maxCapacity > 0
        ? Math.round((currentStock / w.maxCapacity) * 100)
        : 0;
    const remainingCapacity = w.maxCapacity - currentStock;

    res.json({
      ...w,
      currentStock,
      itemCount,
      percentage,
      remainingCapacity,
    });
  } catch (error) {
    console.error("Get warehouse error:", error);
    res.status(500).json({ error: "Gagal memuat detail gudang" });
  }
});

export default router;
