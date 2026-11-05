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
import { eq, ilike, and, or, sql, desc, gte, inArray, type SQL } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import {
  calculateStockStatus,
  isWarehouseCategoryAllowed,
  STOCK_KRITIS_MAX,
  STOCK_MENIPIS_MAX,
} from "../lib/businessRules.js";

const router = Router();

router.use(requireAuth);

/** Padanan SQL dari calculateStockStatus() untuk update stok atomik di database. */
const stockStatusSql = (qty: SQL) =>
  sql<string>`CASE WHEN ${qty} <= ${STOCK_KRITIS_MAX} THEN 'KRITIS' WHEN ${qty} <= ${STOCK_MENIPIS_MAX} THEN 'MENIPIS' ELSE 'AMAN' END`;

/**
 * Memvalidasi kecocokan gudang-kategori dalam 1 query (warehouse LEFT JOIN category).
 * Mengembalikan pesan error bila kategori ditolak, atau null bila diizinkan.
 */
async function warehouseCategoryError(warehouseId: number, categoryId: number): Promise<string | null> {
  const [target] = await db
    .select({
      name: warehouse.name,
      allowedCategoryId: warehouse.allowedCategoryId,
      allowedCategoryName: category.name,
    })
    .from(warehouse)
    .leftJoin(category, eq(category.id, warehouse.allowedCategoryId))
    .where(eq(warehouse.id, warehouseId))
    .limit(1);

  if (target && !isWarehouseCategoryAllowed(target.allowedCategoryId, categoryId)) {
    return `Gudang "${target.name}" hanya menerima kategori "${target.allowedCategoryName || "tertentu"}"`;
  }
  return null;
}

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
      // Subquery slug -> id: tanpa round-trip lookup terpisah
      conditions.push(
        inArray(
          item.categoryId,
          db.select({ id: category.id }).from(category).where(eq(category.slug, categorySlug))
        )
      );
    }

    if (typeSlug) {
      conditions.push(
        inArray(
          item.itemTypeId,
          db.select({ id: itemType.id }).from(itemType).where(eq(itemType.slug, typeSlug))
        )
      );
    }

    if (size) {
      conditions.push(eq(item.size, size));
    }

    if (status) {
      conditions.push(eq(item.status, status));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Total count + ringkasan status dan halaman data tidak saling bergantung -> paralel
    const [countResult, items] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          aman: sql<number>`count(*) filter (where ${item.status} = 'AMAN')`,
          menipis: sql<number>`count(*) filter (where ${item.status} = 'MENIPIS')`,
          kritis: sql<number>`count(*) filter (where ${item.status} = 'KRITIS')`,
        })
        .from(item)
        .where(whereClause),
      db
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
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    const aman = Number(countResult[0]?.aman ?? 0);
    const menipis = Number(countResult[0]?.menipis ?? 0);
    const kritis = Number(countResult[0]?.kritis ?? 0);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total,
        aman,
        menipis,
        kritis,
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
    const categoryError = await warehouseCategoryError(warehouseId, categoryId);
    if (categoryError) {
      res.status(400).json({ error: categoryError });
      return;
    }

    const initialQty = quantity || 0;

    // Item + activity log ditulis atomik: tidak ada barang tanpa log MASUK-nya
    const newItem = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(item)
        .values({
          code,
          name,
          categoryId,
          itemTypeId,
          materialType: materialType || null,
          size,
          quantity: initialQty,
          warehouseId,
          notes: notes || null,
          status: calculateStockStatus(initialQty),
          createdById: req.user!.id,
          entryDate: new Date(),
        })
        .returning();

      if (initialQty > 0) {
        await tx.insert(activityLog).values({
          type: "MASUK",
          itemId: created.id,
          warehouseId,
          quantity: initialQty,
          createdById: req.user!.id,
        });
      }

      return created;
    });

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
      const categoryError = await warehouseCategoryError(checkWarehouseId, checkCategoryId);
      if (categoryError) {
        res.status(400).json({ error: categoryError });
        return;
      }
    }

    // quantity/status hanya ditulis bila dikirim. Menulis ulang existing.quantity
    // yang dibaca di awal bisa menimpa penyesuaian stok konkuren (lost update).
    const stockFields =
      quantity !== undefined && quantity !== null
        ? { quantity, status: calculateStockStatus(quantity) }
        : {};

    const [updated] = await db
      .update(item)
      .set({
        code: code ?? existing.code,
        name: name ?? existing.name,
        categoryId: categoryId ?? existing.categoryId,
        itemTypeId: itemTypeId ?? existing.itemTypeId,
        materialType: materialType ?? existing.materialType,
        size: size ?? existing.size,
        ...stockFields,
        warehouseId: warehouseId ?? existing.warehouseId,
        notes: notes ?? existing.notes,
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

    // Hapus dependensi FK lalu barangnya secara atomik: gagal di tengah = tidak ada yang terhapus
    await db.transaction(async (tx) => {
      await tx.delete(activityLog).where(eq(activityLog.itemId, id));
      await tx.delete(transfer).where(eq(transfer.itemId, id));
      await tx.delete(item).where(eq(item.id, id));
    });

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
    if (!Number.isInteger(adjustment) || adjustment === 0) {
      res
        .status(400)
        .json({ error: "Jumlah adjustment harus berupa angka dan tidak boleh 0" });
      return;
    }

    const userId = req.user!.id;
    const ownedItem = and(eq(item.id, id), eq(item.createdById, userId));

    // UPDATE atomik bersyarat: hitung stok baru di database (quantity + adj) dan
    // tolak bila hasilnya negatif. Tidak ada jeda baca-tulis -> aman dari race
    // condition antar request, dan tidak perlu SELECT terpisah di jalur sukses.
    const newQty = sql`${item.quantity} + ${adjustment}`;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(item)
        .set({
          quantity: newQty,
          status: stockStatusSql(newQty),
          updatedAt: new Date(),
        })
        .where(and(ownedItem, gte(newQty, 0)))
        .returning();

      if (!row) return null;

      await tx.insert(activityLog).values({
        type: adjustment > 0 ? "MASUK" : "KELUAR",
        itemId: id,
        warehouseId: row.warehouseId,
        quantity: Math.abs(adjustment),
        createdById: userId,
      });

      return row;
    });

    if (!updated) {
      // Jalur gagal saja: bedakan "tidak ditemukan" dari "stok tidak cukup"
      const existing = await db.query.item.findFirst({
        columns: { quantity: true },
        where: ownedItem,
      });
      if (!existing) {
        res.status(404).json({ error: "Barang tidak ditemukan" });
      } else {
        res.status(400).json({
          error: `Stok tidak mencukupi. Stok saat ini: ${existing.quantity} pcs`,
        });
      }
      return;
    }

    res.json({
      message: `Stok berhasil di-update. Stok baru: ${updated.quantity} pcs`,
      item: updated,
    });
  } catch (error) {
    console.error("Stock adjustment error:", error);
    res.status(500).json({ error: "Gagal memperbarui stok" });
  }
});

export default router;
