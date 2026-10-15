import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeOutgoingTransaction,
  TransactionValidationError,
} from "../src/lib/transactionService.js";

describe("White-Box Unit Test: Transaction Logic & Database Reliability", () => {
  let mockDb: any;
  let mockTx: any;
  const testUserId = "user-test-uuid";

  beforeEach(() => {
    // Inisialisasi Mock Transaction Context
    mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ transactionCode: "KB-00010" }]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 99, transactionCode: "KB-00011" }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true),
        }),
      }),
      query: {
        item: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            name: "Kemeja Oxford",
            quantity: 50,
            warehouseId: 1,
          }),
        },
      },
    };

    // Inisialisasi Mock Top-Level DB
    mockDb = {
      query: {
        item: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            name: "Kemeja Oxford",
            quantity: 50,
            warehouseId: 1,
            createdById: testUserId,
          }),
        },
      },
      transaction: vi.fn().mockImplementation(async (callback) => {
        return await callback(mockTx);
      }),
    };
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Skenario 1: Skenario Sukses (Happy Path)
  // ──────────────────────────────────────────────────────────────────────────
  it("Path 1 (Success): Valid input, sufficient stock, and successful Drizzle commit", async () => {
    const payload = {
      date: "2026-10-15T00:00:00.000Z",
      items: [{ itemId: 1, quantity: 10 }],
    };

    const result = await executeOutgoingTransaction(mockDb, testUserId, payload);

    expect(result.transactionCode).toBe("KB-00011");
    expect(result.transactionId).toBe(99);
    expect(result.itemsProcessed).toBe(1);

    // Verifikasi pemanggilan transaction Drizzle
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.insert).toHaveBeenCalledTimes(3); // header + detail + activity log
    expect(mockTx.update).toHaveBeenCalledTimes(1); // update stock item
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Skenario 2: Skenario Gagal 1 (Boundary Conditions)
  // ──────────────────────────────────────────────────────────────────────────
  it("Path 2 (Boundary): Throws specific error when requested quantity exceeds available stock", async () => {
    mockDb.query.item.findFirst.mockResolvedValueOnce({
      id: 1,
      name: "Kemeja Oxford",
      quantity: 50,
      createdById: testUserId,
    });

    const payload = {
      items: [{ itemId: 1, quantity: 51 }], // Melebihi 50
    };

    await expect(
      executeOutgoingTransaction(mockDb, testUserId, payload)
    ).rejects.toThrowError(
      'Stok untuk "Kemeja Oxford" tidak mencukupi. Tersedia: 50 Pcs, diminta: 51 Pcs.'
    );

    // Pastikan transaksi tidak dipanggil saat validasi gagal
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("Path 3 (Boundary Exact): Allows transaction when requested quantity exactly equals stock", async () => {
    mockDb.query.item.findFirst.mockResolvedValueOnce({
      id: 1,
      name: "Kemeja Oxford",
      quantity: 50,
      createdById: testUserId,
    });

    const payload = {
      items: [{ itemId: 1, quantity: 50 }], // Tepat 50
    };

    const result = await executeOutgoingTransaction(mockDb, testUserId, payload);
    expect(result.transactionId).toBe(99);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Skenario 3: Skenario Gagal 2 (Validation Conditions)
  // ──────────────────────────────────────────────────────────────────────────
  it("Path 4 (Validation): Throws error on zero or negative quantity", async () => {
    // Kuantitas 0
    await expect(
      executeOutgoingTransaction(mockDb, testUserId, { items: [{ itemId: 1, quantity: 0 }] })
    ).rejects.toThrowError("ID barang dan jumlah yang valid wajib diisi");

    // Kuantitas Negatif
    await expect(
      executeOutgoingTransaction(mockDb, testUserId, { items: [{ itemId: 1, quantity: -10 }] })
    ).rejects.toThrowError("ID barang dan jumlah yang valid wajib diisi");

    // Daftar barang kosong
    await expect(
      executeOutgoingTransaction(mockDb, testUserId, { items: [] })
    ).rejects.toThrowError("Daftar barang tidak boleh kosong");

    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("Path 5 (Validation): Throws error when item does not exist or belongs to another user", async () => {
    mockDb.query.item.findFirst.mockResolvedValueOnce(null);

    await expect(
      executeOutgoingTransaction(mockDb, testUserId, { items: [{ itemId: 999, quantity: 5 }] })
    ).rejects.toThrowError("Barang dengan ID 999 tidak ditemukan");

    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Skenario 4: Keandalan Transaksi Database & Rollback
  // ──────────────────────────────────────────────────────────────────────────
  it("Path 6 (Rollback): Aborts and rolls back transaction when database error occurs midway", async () => {
    const dbError = new Error("Postgres connection reset during insert");

    // db.transaction melempar error saat eksekusi callback
    mockDb.transaction.mockImplementationOnce(async (callback: any) => {
      // Simulasikan kegagalan pada insert kedua
      mockTx.insert.mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 99 }]),
        }),
      }));
      mockTx.insert.mockImplementationOnce(() => {
        throw dbError;
      });

      return await callback(mockTx);
    });

    await expect(
      executeOutgoingTransaction(mockDb, testUserId, { items: [{ itemId: 1, quantity: 5 }] })
    ).rejects.toThrow("Postgres connection reset during insert");

    // Verifikasi callback dijalankan dan error dipropagasi
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it("Path 7 (Midway Failure): Throws error if item vanishes inside transaction block", async () => {
    mockTx.query.item.findFirst.mockResolvedValueOnce(null);

    await expect(
      executeOutgoingTransaction(mockDb, testUserId, { items: [{ itemId: 1, quantity: 5 }] })
    ).rejects.toThrow("Barang tidak ditemukan di tengah transaksi");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Skenario 5: Algorithmic Optimization (Query Batching & Sequence)
  // ──────────────────────────────────────────────────────────────────────────
  it("Path 8 (Batching Multiple Items): Batches inserts and updates for multiple items", async () => {
    // Mock 3 items returned by findFirst / findMany
    const itemCatalog = [
      { id: 10, name: "Kemeja Putih", quantity: 100, warehouseId: 1, createdById: testUserId },
      { id: 20, name: "Celana Chino", quantity: 80, warehouseId: 1, createdById: testUserId },
      { id: 30, name: "Jaket Denim", quantity: 50, warehouseId: 2, createdById: testUserId },
    ];

    mockDb.query.item.findMany = vi.fn().mockResolvedValue(itemCatalog);
    mockTx.query.item.findMany = vi.fn().mockResolvedValue(itemCatalog);

    const payload = {
      items: [
        { itemId: 10, quantity: 10 },
        { itemId: 20, quantity: 20 },
        { itemId: 30, quantity: 5 },
      ],
    };

    const result = await executeOutgoingTransaction(mockDb, testUserId, payload);

    expect(result.itemsProcessed).toBe(3);
    // Verifikasi bahwa findMany dipanggil secara batch alih-alih N kali findFirst
    expect(mockDb.query.item.findMany).toHaveBeenCalledTimes(1);
    expect(mockTx.query.item.findMany).toHaveBeenCalledTimes(1);

    // Header (1) + Batch Items (1) + Batch Activity Logs (1) = Tepat 3 pemanggilan insert!
    expect(mockTx.insert).toHaveBeenCalledTimes(3);

    // 3 update stok barang
    expect(mockTx.update).toHaveBeenCalledTimes(3);
  });

  it("Path 9 (PostgreSQL Sequence): Uses atomic sequence nextval when tx.execute is available", async () => {
    mockTx.execute = vi.fn().mockResolvedValue({
      rows: [{ next_val: "42" }],
    });

    const payload = {
      items: [{ itemId: 1, quantity: 5 }],
    };

    const result = await executeOutgoingTransaction(mockDb, testUserId, payload);

    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    expect(result.transactionCode).toBe("KB-00042");
    // Karena sequence digunakan, fallback select tidak perlu dipanggil
    expect(mockTx.select).not.toHaveBeenCalled();
  });

  it("Path 10 (Sequence Fallback Graceful): Falls back to select query when sequence throws error", async () => {
    mockTx.execute = vi.fn().mockRejectedValue(new Error("relation 'outgoing_tx_seq' does not exist"));

    const payload = {
      items: [{ itemId: 1, quantity: 5 }],
    };

    const result = await executeOutgoingTransaction(mockDb, testUserId, payload);

    // Memverifikasi graceful fallback ke SELECT latest record
    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    expect(mockTx.select).toHaveBeenCalledTimes(1);
    expect(result.transactionCode).toBe("KB-00011");
  });
});


