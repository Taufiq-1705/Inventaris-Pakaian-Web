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
import {
  canWarehouseAcceptQuantity,
  calculateStockStatus,
  isWarehouseCategoryAllowed,
} from "../lib/businessRules.js";
import { TransactionValidationError } from "../lib/transactionService.js";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/transfers
 * Execute a transfer between warehouses.
 *
 * This is transactional — inside ONE database transaction it:
 * 1. Locks the source item row (FOR UPDATE) and validates it has enough stock
 * 2. Validates destination warehouse category & capacity (scoped to user's inventory)
 * 3. Decreases source item quantity
 * 4. Creates or updates destination item record
 * 5. Creates transfer record
 * 6. Logs activity
 */
router.post("/", async (req, res) => {
  try {
    const { itemId, sourceWarehouseId, destWarehouseId, quantity } = req.body;

    // Basic validation
    if (!itemId || !sourceWarehouseId || !destWarehouseId || quantity === undefined || quantity === null) {
      res.status(400).json({
        message: "Item, gudang asal, gudang tujuan, dan jumlah wajib diisi",
        error: "Item, gudang asal, gudang tujuan, dan jumlah wajib diisi",
      });
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
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

    const userId = req.user!.id;
    const fail = (status: number, message: string) => new TransactionValidationError(message, status);

    // --- Validasi + eksekusi dalam SATU transaksi ---
    // Baris barang asal dikunci (FOR UPDATE) sebelum stok dibaca, sehingga dua
    // transfer konkuren atas barang yang sama tidak bisa sama-sama lolos cek stok.
    const newTransfer = await db.transaction(async (tx) => {
      const [sourceItem] = await tx
        .select()
        .from(item)
        .where(and(eq(item.id, itemId), eq(item.createdById, userId)))
        .for("update");

      if (!sourceItem) throw fail(404, "Barang tidak ditemukan");
      if (sourceItem.warehouseId !== sourceWarehouseId) {
        throw fail(400, "Barang tidak berada di gudang asal yang dipilih");
      }
      if (sourceItem.quantity < quantity) {
        throw fail(400, `Stok tidak mencukupi. Stok tersedia: ${sourceItem.quantity} pcs`);
      }

      // Gudang tujuan + nama kategori yang diizinkan + stok user saat ini: 1 query
      const [destWarehouse] = await tx
        .select({
          name: warehouse.name,
          maxCapacity: warehouse.maxCapacity,
          allowedCategoryId: warehouse.allowedCategoryId,
          allowedCategoryName: category.name,
          currentStock: sql<number>`coalesce(sum(${item.quantity}), 0)::integer`,
        })
        .from(warehouse)
        .leftJoin(category, eq(category.id, warehouse.allowedCategoryId))
        .leftJoin(item, and(eq(item.warehouseId, warehouse.id), eq(item.createdById, userId)))
        .where(eq(warehouse.id, destWarehouseId))
        .groupBy(warehouse.id, category.name);

      if (!destWarehouse) throw fail(404, "Gudang tujuan tidak ditemukan");

      if (!isWarehouseCategoryAllowed(destWarehouse.allowedCategoryId, sourceItem.categoryId)) {
        throw fail(
          400,
          `Gudang tujuan "${destWarehouse.name}" hanya menerima kategori "${destWarehouse.allowedCategoryName || "tertentu"}"`
        );
      }

      const capacityCheck = canWarehouseAcceptQuantity(
        Number(destWarehouse.currentStock),
        destWarehouse.maxCapacity,
        quantity
      );
      if (!capacityCheck.allowed) {
        throw fail(
          400,
          `Kapasitas gudang tujuan tidak mencukupi. Sisa kapasitas: ${capacityCheck.remainingCapacity} pcs`
        );
      }

      const newSourceQty = sourceItem.quantity - quantity;
      const sourceStatus = calculateStockStatus(newSourceQty);
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
    if (error instanceof TransactionValidationError) {
      // Validasi gagal di dalam transaksi -> sudah di-ROLLBACK, kembalikan 4xx
      res.status(error.statusCode).json({ message: error.message, error: error.message });
      return;
    }
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

    // Halaman data dan total tidak saling bergantung -> paralel
    const [transfers, countResult] = await Promise.all([
      db.query.transfer.findMany({
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
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(transfer)
        .where(eq(transfer.createdById, userId)),
    ]);
    const total = Number(countResult[0]?.count ?? 0);

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
