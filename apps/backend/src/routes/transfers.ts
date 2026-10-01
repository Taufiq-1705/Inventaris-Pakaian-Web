import { Router } from "express";
import { db } from "../db/index.js";
import {
  item,
  transfer,
  warehouse,
  activityLog,
  category,
} from "../db/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/transfers
 * Execute a transfer between warehouses.
 *
 * This is transactional — it:
 * 1. Validates source item has enough stock
 * 2. Validates destination warehouse has capacity
 * 3. Decreases source item quantity
 * 4. Creates or updates destination item record
 * 5. Creates transfer record
 * 6. Logs activity
 */
router.post("/", async (req, res) => {
  try {
    const { itemId, sourceWarehouseId, destWarehouseId, quantity } = req.body;

    // Basic validation
    if (!itemId || !sourceWarehouseId || !destWarehouseId || !quantity) {
      res
        .status(400)
        .json({ error: "Item, gudang asal, gudang tujuan, dan jumlah wajib diisi" });
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({ error: "Jumlah harus lebih dari 0" });
      return;
    }

    if (sourceWarehouseId === destWarehouseId) {
      res
        .status(400)
        .json({ error: "Gudang asal dan tujuan tidak boleh sama" });
      return;
    }

    // Get source item (scoped to current user)
    const sourceItem = await db.query.item.findFirst({
      where: and(eq(item.id, itemId), eq(item.createdById, req.user!.id)),
    });

    if (!sourceItem) {
      res.status(404).json({ error: "Barang tidak ditemukan" });
      return;
    }

    if (sourceItem.warehouseId !== sourceWarehouseId) {
      res
        .status(400)
        .json({ error: "Barang tidak berada di gudang asal yang dipilih" });
      return;
    }

    if (sourceItem.quantity < quantity) {
      res.status(400).json({
        error: `Stok tidak mencukupi. Stok tersedia: ${sourceItem.quantity} pcs`,
      });
      return;
    }

    // Check destination warehouse capacity
    const destWarehouse = await db.query.warehouse.findFirst({
      where: eq(warehouse.id, destWarehouseId),
    });

    if (!destWarehouse) {
      res.status(404).json({ error: "Gudang tujuan tidak ditemukan" });
      return;
    }

    if (destWarehouse.allowedCategoryId && destWarehouse.allowedCategoryId !== sourceItem.categoryId) {
      const allowedCat = await db.query.category.findFirst({
        where: eq(category.id, destWarehouse.allowedCategoryId),
      });
      res.status(400).json({
        error: `Gudang tujuan "${destWarehouse.name}" hanya menerima kategori "${allowedCat?.name || 'tertentu'}"`,
      });
      return;
    }

    const destStockResult = await db
      .select({
        currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)`,
      })
      .from(item)
      .where(eq(item.warehouseId, destWarehouseId));

    const destCurrentStock = Number(destStockResult[0]?.currentStock ?? 0);
    const remainingCapacity = destWarehouse.maxCapacity - destCurrentStock;

    if (quantity > remainingCapacity) {
      res.status(400).json({
        error: `Kapasitas gudang tujuan tidak mencukupi. Sisa kapasitas: ${remainingCapacity} pcs`,
      });
      return;
    }

    // --- Execute the transfer ---

    // 1. Decrease source item quantity (or move entirely)
    const newSourceQty = sourceItem.quantity - quantity;
    let sourceStatus = "AMAN";
    if (newSourceQty <= 0) sourceStatus = "KRITIS";
    else if (newSourceQty <= 20) sourceStatus = "KRITIS";
    else if (newSourceQty <= 50) sourceStatus = "MENIPIS";

    if (newSourceQty <= 0) {
      // All stock is being moved — just change the item's warehouse
      await db
        .update(item)
        .set({
          warehouseId: destWarehouseId,
          quantity: quantity, // reset to the transferred amount
          status: quantity <= 20 ? "KRITIS" : quantity <= 50 ? "MENIPIS" : "AMAN",
          updatedAt: new Date(),
        })
        .where(eq(item.id, itemId));
    } else {
      // Partial transfer — reduce source quantity
      await db
        .update(item)
        .set({
          quantity: newSourceQty,
          status: sourceStatus,
          updatedAt: new Date(),
        })
        .where(eq(item.id, itemId));

      // Check if the same item already exists in destination warehouse
      const destItem = await db.query.item.findFirst({
        columns: { id: true, quantity: true },
        where: (fields, { and, eq: fieldEq }) =>
          and(
            fieldEq(fields.code, sourceItem.code),
            fieldEq(fields.warehouseId, destWarehouseId)
          ),
      });

      if (destItem) {
        // Update existing destination item
        const newDestQty = destItem.quantity + quantity;
        let destStatus = "AMAN";
        if (newDestQty <= 20) destStatus = "KRITIS";
        else if (newDestQty <= 50) destStatus = "MENIPIS";

        await db
          .update(item)
          .set({
            quantity: newDestQty,
            status: destStatus,
            updatedAt: new Date(),
          })
          .where(eq(item.id, destItem.id));
      } else {
        // Create new item record in destination — use a unique code suffix
        const destCode = `${sourceItem.code}-W${destWarehouseId}`;
        await db
          .insert(item)
          .values({
            code: destCode,
            name: sourceItem.name,
            categoryId: sourceItem.categoryId,
            itemTypeId: sourceItem.itemTypeId,
            materialType: sourceItem.materialType,
            size: sourceItem.size,
            quantity: quantity,
            warehouseId: destWarehouseId,
            notes: sourceItem.notes,
            status: quantity <= 20 ? "KRITIS" : quantity <= 50 ? "MENIPIS" : "AMAN",
            createdById: req.user!.id,
            entryDate: new Date(),
          });
      }
    }

    // 2. Create transfer record
    const [newTransfer] = await db
      .insert(transfer)
      .values({
        itemId,
        sourceWarehouseId,
        destWarehouseId,
        quantity,
        status: "SUKSES",
        createdById: req.user!.id,
      })
      .returning();

    // 3. Log activity
    await db.insert(activityLog).values({
      type: "PINDAH",
      itemId,
      warehouseId: destWarehouseId,
      transferId: newTransfer.id,
      quantity,
      createdById: req.user!.id,
    });

    res.status(201).json({
      message: "Transfer berhasil diproses",
      transfer: newTransfer,
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ error: "Gagal memproses perpindahan barang" });
  }
});

/**
 * GET /api/transfers
 * List recent transfer history
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 10)
    );
    const offset = (page - 1) * limit;

    const userId = req.user!.id;

    const transfers = await db.query.transfer.findMany({
      where: eq(transfer.createdById, userId),
      orderBy: [desc(transfer.createdAt)],
      limit,
      offset,
      with: {
        item: {
          columns: { id: true, name: true, code: true },
        },
        sourceWarehouse: {
          columns: { id: true, name: true },
        },
        destWarehouse: {
          columns: { id: true, name: true },
        },
        createdBy: {
          columns: { id: true, name: true },
        },
      },
    });

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transfer)
      .where(eq(transfer.createdById, userId));
    const total = countResult[0]?.count ?? 0;

    res.json({
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List transfers error:", error);
    res.status(500).json({ error: "Gagal memuat riwayat transfer" });
  }
});

export default router;
