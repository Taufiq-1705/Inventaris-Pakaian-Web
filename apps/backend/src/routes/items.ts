import { Router } from "express";
import { db } from "../db/index.js";
import {
  item,
  category,
  itemType,
  warehouse,
  activityLog,
  transfer,
} from "../db/schema.js";
import { eq, ilike, and, or, sql, desc, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/items
 * List items with filtering, search, and pagination.
 *
 * Query params:
 *   ?page=1&limit=10
 *   &search=oversized        (searches code + name)
 *   &warehouse=1             (filter by warehouse ID)
 *   &category=top            (filter by category slug)
 *   &type=kaos               (filter by item type slug)
 *   &size=XL                 (filter by size)
 *   &status=KRITIS           (filter by stock status)
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 10)
    );
    const offset = (page - 1) * limit;

    const search = req.query.search as string | undefined;
    const warehouseId = req.query.warehouse
      ? parseInt(req.query.warehouse as string)
      : undefined;
    const categorySlug = req.query.category as string | undefined;
    const typeSlug = req.query.type as string | undefined;
    const size = req.query.size as string | undefined;
    const status = req.query.status as string | undefined;

    // Build conditions array — always scope to current user
    const conditions: any[] = [eq(item.createdById, req.user!.id)];

    if (search) {
      conditions.push(
        or(
          ilike(item.code, `%${search}%`),
          ilike(item.name, `%${search}%`)
        )
      );
    }

    if (warehouseId) {
      conditions.push(eq(item.warehouseId, warehouseId));
    }

    if (categorySlug) {
      // Find category by slug, then filter
      const cat = await db.query.category.findFirst({
        where: eq(category.slug, categorySlug),
      });
      if (cat) {
        conditions.push(eq(item.categoryId, cat.id));
      }
    }

    if (typeSlug) {
      const type = await db.query.itemType.findFirst({
        where: eq(itemType.slug, typeSlug),
      });
      if (type) {
        conditions.push(eq(item.itemTypeId, type.id));
      }
    }

    if (size) {
      conditions.push(eq(item.size, size));
    }

    if (status) {
      conditions.push(eq(item.status, status));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(item)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    // Get items with relations
    const items = await db
      .select({
        id: item.id,
        code: item.code,
        name: item.name,
        materialType: item.materialType,
        size: item.size,
        quantity: item.quantity,
        status: item.status,
        notes: item.notes,
        entryDate: item.entryDate,
        categoryName: category.name,
        categoryId: item.categoryId,
        typeName: itemType.name,
        warehouseName: warehouse.name,
        warehouseId: item.warehouseId,
      })
      .from(item)
      .leftJoin(category, eq(item.categoryId, category.id))
      .leftJoin(itemType, eq(item.itemTypeId, itemType.id))
      .leftJoin(warehouse, eq(item.warehouseId, warehouse.id))
      .where(whereClause)
      .orderBy(desc(item.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List items error:", error);
    res.status(500).json({ error: "Gagal memuat data barang" });
  }
});

/**
 * GET /api/items/:id
 * Get a single item with full details
 */
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tidak valid" });
      return;
    }

    const result = await db.query.item.findFirst({
      where: and(eq(item.id, id), eq(item.createdById, req.user!.id)),
      with: {
        category: true,
        itemType: true,
        warehouse: true,
        createdBy: {
          columns: { id: true, name: true },
        },
      },
    });

    if (!result) {
      res.status(404).json({ error: "Barang tidak ditemukan" });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error("Get item error:", error);
    res.status(500).json({ error: "Gagal memuat detail barang" });
  }
});

/**
 * POST /api/items
 * Create a new inventory item
 */
router.post("/", async (req, res) => {
  try {
    const {
      code,
      name,
      categoryId,
      itemTypeId,
      materialType,
      size,
      quantity,
      warehouseId,
      notes,
    } = req.body;

    // Basic validation
    if (!code || !name || !categoryId || !itemTypeId || !size || !warehouseId) {
      res.status(400).json({
        error: "Kode, nama, kategori, tipe, ukuran, dan gudang wajib diisi",
      });
      return;
    }
    // Validate warehouse-category compatibility
    const targetWarehouse = await db.query.warehouse.findFirst({
      where: eq(warehouse.id, warehouseId),
    });
    if (targetWarehouse?.allowedCategoryId && targetWarehouse.allowedCategoryId !== categoryId) {
      const allowedCat = await db.query.category.findFirst({
        where: eq(category.id, targetWarehouse.allowedCategoryId),
      });
      res.status(400).json({
        error: `Gudang "${targetWarehouse.name}" hanya menerima kategori "${allowedCat?.name || 'tertentu'}"`,
      });
      return;
    }

    // Determine status based on quantity
    let status = "AMAN";
    if (quantity <= 0) status = "KRITIS";
    else if (quantity <= 20) status = "KRITIS";
    else if (quantity <= 50) status = "MENIPIS";

    const [newItem] = await db
      .insert(item)
      .values({
        code,
        name,
        categoryId,
        itemTypeId,
        materialType: materialType || null,
        size,
        quantity: quantity || 0,
        warehouseId,
        notes: notes || null,
        status,
        createdById: req.user!.id,
        entryDate: new Date(),
      })
      .returning();

    // Log the activity
    if (quantity > 0) {
      await db.insert(activityLog).values({
        type: "MASUK",
        itemId: newItem.id,
        warehouseId,
        quantity,
        createdById: req.user!.id,
      });
    }

    res.status(201).json(newItem);
  } catch (error: any) {
    console.error("Create item error:", error);
    if (error?.code === "23505") {
      // Unique constraint violation (duplicate code)
      res.status(409).json({ error: "Kode barang sudah digunakan" });
      return;
    }
    res.status(500).json({ error: "Gagal menambahkan barang" });
  }
});

/**
 * PUT /api/items/:id
 * Update an existing item
 */
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tidak valid" });
      return;
    }

    const existing = await db.query.item.findFirst({
      where: and(eq(item.id, id), eq(item.createdById, req.user!.id)),
    });

    if (!existing) {
      res.status(404).json({ error: "Barang tidak ditemukan" });
      return;
    }

    const {
      code,
      name,
      categoryId,
      itemTypeId,
      materialType,
      size,
      quantity,
      warehouseId,
      notes,
    } = req.body;

    const checkWarehouseId = warehouseId ?? existing.warehouseId;
    const checkCategoryId = categoryId ?? existing.categoryId;

    if (checkWarehouseId) {
      const targetWarehouse = await db.query.warehouse.findFirst({
        where: eq(warehouse.id, checkWarehouseId),
      });
      if (targetWarehouse?.allowedCategoryId && targetWarehouse.allowedCategoryId !== checkCategoryId) {
        const allowedCat = await db.query.category.findFirst({
          where: eq(category.id, targetWarehouse.allowedCategoryId),
        });
        res.status(400).json({
          error: `Gudang "${targetWarehouse.name}" hanya menerima kategori "${allowedCat?.name || 'tertentu'}"`,
        });
        return;
      }
    }

    // Determine new status
    const newQty = quantity ?? existing.quantity;
    let status = "AMAN";
    if (newQty <= 0) status = "KRITIS";
    else if (newQty <= 20) status = "KRITIS";
    else if (newQty <= 50) status = "MENIPIS";

    const [updated] = await db
      .update(item)
      .set({
        code: code ?? existing.code,
        name: name ?? existing.name,
        categoryId: categoryId ?? existing.categoryId,
        itemTypeId: itemTypeId ?? existing.itemTypeId,
        materialType: materialType ?? existing.materialType,
        size: size ?? existing.size,
        quantity: newQty,
        warehouseId: warehouseId ?? existing.warehouseId,
        notes: notes ?? existing.notes,
        status,
        updatedAt: new Date(),
      })
      .where(eq(item.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Update item error:", error);
    res.status(500).json({ error: "Gagal memperbarui barang" });
  }
});

/**
 * DELETE /api/items/:id
 * Delete an item
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tidak valid" });
      return;
    }

    const existing = await db.query.item.findFirst({
      where: and(eq(item.id, id), eq(item.createdById, req.user!.id)),
    });

    if (!existing) {
      res.status(404).json({ error: "Barang tidak ditemukan" });
      return;
    }

    // Delete associated activity logs first to satisfy foreign key constraints
    await db.delete(activityLog).where(eq(activityLog.itemId, id));
    
    // Delete associated transfers first
    await db.delete(transfer).where(eq(transfer.itemId, id));

    await db.delete(item).where(eq(item.id, id));

    res.json({ message: "Barang berhasil dihapus" });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ error: "Gagal menghapus barang" });
  }
});

/**
 * PATCH /api/items/:id/stock
 * Adjust stock for a specific item (add or subtract).
 * Body: { adjustment: number } — positive = MASUK, negative = KELUAR
 */
router.patch("/:id/stock", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tidak valid" });
      return;
    }

    const { adjustment } = req.body;
    if (typeof adjustment !== "number" || adjustment === 0) {
      res
        .status(400)
        .json({ error: "Jumlah adjustment harus berupa angka dan tidak boleh 0" });
      return;
    }

    const existing = await db.query.item.findFirst({
      where: and(eq(item.id, id), eq(item.createdById, req.user!.id)),
    });

    if (!existing) {
      res.status(404).json({ error: "Barang tidak ditemukan" });
      return;
    }

    const newQty = existing.quantity + adjustment;
    if (newQty < 0) {
      res.status(400).json({
        error: `Stok tidak mencukupi. Stok saat ini: ${existing.quantity} pcs`,
      });
      return;
    }

    // Determine new status
    let status = "AMAN";
    if (newQty <= 0) status = "KRITIS";
    else if (newQty <= 20) status = "KRITIS";
    else if (newQty <= 50) status = "MENIPIS";

    const [updated] = await db
      .update(item)
      .set({
        quantity: newQty,
        status,
        updatedAt: new Date(),
      })
      .where(eq(item.id, id))
      .returning();

    // Log the activity
    await db.insert(activityLog).values({
      type: adjustment > 0 ? "MASUK" : "KELUAR",
      itemId: id,
      warehouseId: existing.warehouseId,
      quantity: Math.abs(adjustment),
      createdById: req.user!.id,
    });

    res.json({
      message: `Stok berhasil di-update. Stok baru: ${newQty} pcs`,
      item: updated,
    });
  } catch (error) {
    console.error("Stock adjustment error:", error);
    res.status(500).json({ error: "Gagal memperbarui stok" });
  }
});

export default router;
