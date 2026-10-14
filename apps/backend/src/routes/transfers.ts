import { Router } from "express";
import { db } from "../db/index.js";
import {
  item,
  transfer,
  warehouse,
  activityLog,
  category,
} from "../db/schema.js";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import {
  canWarehouseAcceptQuantity,
  calculateStockStatus,
  isWarehouseCategoryAllowed,
} from "../lib/businessRules.js";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/transfers
 * Execute a transfer between warehouses.
 *
 * This is transactional — it:
 * 1. Validates source item has enough stock
 * 2. Validates destination warehouse has capacity (scoped to user's inventory)
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
      res.status(400).json({
        message: "Item, gudang asal, gudang tujuan, dan jumlah wajib diisi",
        error: "Item, gudang asal, gudang tujuan, dan jumlah wajib diisi",
      });
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({
        message: "Jumlah harus lebih dari 0",
        error: "Jumlah harus lebih dari 0",
      });
      return;
    }

    if (sourceWarehouseId === destWarehouseId) {
      res.status(400).json({
        message: "Gudang asal dan tujuan tidak boleh sama",
        error: "Gudang asal dan tujuan tidak boleh sama",
      });
      return;
    }

    // Get source item (scoped to current user)
    const sourceItem = await db.query.item.findFirst({
      where: and(eq(item.id, itemId), eq(item.createdById, req.user!.id)),
    });

    if (!sourceItem) {
      res.status(404).json({
        message: "Barang tidak ditemukan",
        error: "Barang tidak ditemukan",
      });
      return;
    }

    if (sourceItem.warehouseId !== sourceWarehouseId) {
      res.status(400).json({
        message: "Barang tidak berada di gudang asal yang dipilih",
        error: "Barang tidak berada di gudang asal yang dipilih",
      });
      return;
    }

    if (sourceItem.quantity < quantity) {
      res.status(400).json({
        message: `Stok tidak mencukupi. Stok tersedia: ${sourceItem.quantity} pcs`,
        error: `Stok tidak mencukupi. Stok tersedia: ${sourceItem.quantity} pcs`,
      });
      return;
    }

    // Check destination warehouse
    const destWarehouse = await db.query.warehouse.findFirst({
      where: eq(warehouse.id, destWarehouseId),
    });

    if (!destWarehouse) {
      res.status(404).json({
        message: "Gudang tujuan tidak ditemukan",
        error: "Gudang tujuan tidak ditemukan",
      });
      return;
    }

    if (!isWarehouseCategoryAllowed(destWarehouse.allowedCategoryId, sourceItem.categoryId)) {
      const allowedCat = await db.query.category.findFirst({
        where: eq(category.id, destWarehouse.allowedCategoryId!),
      });
      res.status(400).json({
        message: `Gudang tujuan "${destWarehouse.name}" hanya menerima kategori "${allowedCat?.name || 'tertentu'}"`,
        error: `Gudang tujuan "${destWarehouse.name}" hanya menerima kategori "${allowedCat?.name || 'tertentu'}"`,
      });
      return;
    }

    // Check destination warehouse capacity (scoped to user's stock in warehouse)
    const destStockResult = await db
      .select({
        currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)`,
      })
      .from(item)
      .where(
        and(
          eq(item.warehouseId, destWarehouseId),
          eq(item.createdById, req.user!.id)
        )
      );

    const destCurrentStock = Number(destStockResult[0]?.currentStock ?? 0);
    const capacityCheck = canWarehouseAcceptQuantity(
      destCurrentStock,
      destWarehouse.maxCapacity,
      quantity
    );

    if (!capacityCheck.allowed) {
      res.status(400).json({
        message: `Kapasitas gudang tujuan tidak mencukupi. Sisa kapasitas: ${capacityCheck.remainingCapacity} pcs`,
        error: `Kapasitas gudang tujuan tidak mencukupi. Sisa kapasitas: ${capacityCheck.remainingCapacity} pcs`,
      });
      return;
    }

    // --- Execute the transfer in transaction ---
    const newSourceQty = sourceItem.quantity - quantity;
    const sourceStatus = calculateStockStatus(newSourceQty);

    const newTransfer = await db.transaction(async (tx) => {
      if (newSourceQty <= 0) {
        // All stock is being moved — just change the item's warehouse
        await tx
          .update(item)
          .set({
            warehouseId: destWarehouseId,
            quantity: quantity,
            status: calculateStockStatus(quantity),
            updatedAt: new Date(),
          })
          .where(and(eq(item.id, itemId), eq(item.createdById, req.user!.id)));
      } else {
        // Partial transfer — reduce source quantity
        await tx
          .update(item)
          .set({
            quantity: newSourceQty,
            status: sourceStatus,
            updatedAt: new Date(),
          })
          .where(and(eq(item.id, itemId), eq(item.createdById, req.user!.id)));

        // Check if destination warehouse already has this item for this user
        const destCode = `${sourceItem.code}-W${destWarehouseId}`;
        const destItem = await tx.query.item.findFirst({
          columns: { id: true, quantity: true },
          where: (fields, { and: fAnd, or: fOr, eq: fieldEq }) =>
            fAnd(
              fOr(
                fieldEq(fields.code, sourceItem.code),
                fieldEq(fields.code, destCode)
              ),
              fieldEq(fields.warehouseId, destWarehouseId),
              fieldEq(fields.createdById, req.user!.id)
            ),
        });

        if (destItem) {
          // Update existing destination item
          const newDestQty = destItem.quantity + quantity;
          await tx
            .update(item)
            .set({
              quantity: newDestQty,
              status: calculateStockStatus(newDestQty),
              updatedAt: new Date(),
            })
            .where(and(eq(item.id, destItem.id), eq(item.createdById, req.user!.id)));
        } else {
          // Create new item record in destination — ensure unique code
          let finalDestCode = destCode;
          const codeCollision = await tx.query.item.findFirst({
            columns: { id: true },
            where: eq(item.code, finalDestCode),
          });
          if (codeCollision) {
            finalDestCode = `${destCode}-${Date.now().toString(36).slice(-4)}`;
          }

          await tx
            .insert(item)
            .values({
              code: finalDestCode,
              name: sourceItem.name,
              categoryId: sourceItem.categoryId,
              itemTypeId: sourceItem.itemTypeId,
              materialType: sourceItem.materialType,
              size: sourceItem.size,
              quantity: quantity,
              warehouseId: destWarehouseId,
              notes: sourceItem.notes,
              status: calculateStockStatus(quantity),
              createdById: req.user!.id,
              entryDate: new Date(),
            });
        }
      }

      // Create transfer record
      const [insertedTransfer] = await tx
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

      // Log activity
      await tx.insert(activityLog).values({
        type: "PINDAH",
        itemId,
        warehouseId: destWarehouseId,
        transferId: insertedTransfer.id,
        quantity,
        createdById: req.user!.id,
      });

      return insertedTransfer;
    });

    res.status(201).json({
      message: "Transfer berhasil diproses",
      transfer: newTransfer,
    });
  } catch (error: any) {
    console.error("Transfer error:", error);
    res.status(500).json({
      message: error?.message || "Gagal memproses perpindahan barang",
      error: error?.message || "Gagal memproses perpindahan barang",
    });
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
