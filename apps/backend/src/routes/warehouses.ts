import { Router } from "express";
import { db } from "../db/index.js";
import { warehouse, item } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { calculateWarehouseStatus } from "../lib/businessRules.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/warehouses
 * List all warehouses with computed current stock and capacity percentage
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;

    // Satu query agregasi (LEFT JOIN + GROUP BY) menggantikan 1 + N query per gudang.
    // count(item.id), bukan count(*): gudang tanpa barang harus bernilai 0, bukan 1.
    const rows = await db
      .select({
        id: warehouse.id,
        name: warehouse.name,
        description: warehouse.description,
        locationLabel: warehouse.locationLabel,
        maxCapacity: warehouse.maxCapacity,
        allowedCategoryId: warehouse.allowedCategoryId,
        currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)::integer`,
        itemCount: sql<number>`count(${item.id})::integer`,
      })
      .from(warehouse)
      .leftJoin(item, and(eq(item.warehouseId, warehouse.id), eq(item.createdById, userId)))
      .groupBy(warehouse.id)
      .orderBy(warehouse.id);

    const result = rows.map((w) => {
      const currentStock = Number(w.currentStock ?? 0);
      const percentage =
        w.maxCapacity > 0
          ? Math.round((currentStock / w.maxCapacity) * 100)
          : 0;

      return {
        ...w,
        currentStock,
        itemCount: Number(w.itemCount ?? 0),
        percentage,
        status: calculateWarehouseStatus(percentage),
      };
    });

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

    const userId = req.user!.id;
    const [w] = await db
      .select({
        id: warehouse.id,
        name: warehouse.name,
        description: warehouse.description,
        locationLabel: warehouse.locationLabel,
        maxCapacity: warehouse.maxCapacity,
        allowedCategoryId: warehouse.allowedCategoryId,
        createdAt: warehouse.createdAt,
        updatedAt: warehouse.updatedAt,
        currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)::integer`,
        itemCount: sql<number>`count(${item.id})::integer`,
      })
      .from(warehouse)
      .leftJoin(item, and(eq(item.warehouseId, warehouse.id), eq(item.createdById, userId)))
      .where(eq(warehouse.id, id))
      .groupBy(warehouse.id);

    if (!w) {
      res.status(404).json({ error: "Gudang tidak ditemukan" });
      return;
    }

    const currentStock = Number(w.currentStock ?? 0);
    const itemCount = Number(w.itemCount ?? 0);
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
