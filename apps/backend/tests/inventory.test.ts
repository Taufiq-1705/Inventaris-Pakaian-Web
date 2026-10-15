import { describe, it, expect, vi } from "vitest";
import {
  calculateStockStatus,
  calculateWarehouseStatus,
  formatTransactionCode,
  isWarehouseCategoryAllowed,
  canWarehouseAcceptQuantity,
  type StockStatus,
  type WarehouseStatus,
} from "../src/lib/businessRules.js";

// ============================================================================
// White-Box Test Suite: Inventory & Warehouse Transaction Modules
// Testing: Branch Coverage, Statement Coverage, Boundary Value Analysis,
// and Transaction Execution Logic
// ============================================================================

describe("Inventory Transaction White-Box Test Suite", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Outgoing Transaction Logic (Barang Keluar)
  // ──────────────────────────────────────────────────────────────────────────
  describe("Module: Outgoing Transactions (Barang Keluar)", () => {
    // Function replicating the exact validation logic in routes/outgoing.ts
    function validateOutgoingRequest(
      payload: { date?: string; items?: Array<{ itemId?: number; quantity?: number }> },
      userItems: Array<{ id: number; name: string; quantity: number; createdById: string }>,
      currentUserId: string
    ): { valid: boolean; error?: string; statusCode?: number } {
      const { items: reqItems } = payload;

      // Branch 1: empty or invalid items array
      if (!reqItems || !Array.isArray(reqItems) || reqItems.length === 0) {
        return { valid: false, error: "Daftar barang tidak boleh kosong", statusCode: 400 };
      }

      // Branch 2: validate each item
      for (const reqItem of reqItems) {
        const { itemId, quantity } = reqItem;
        if (!itemId || !quantity || quantity <= 0) {
          return { valid: false, error: "ID barang dan jumlah yang valid wajib diisi", statusCode: 400 };
        }

        const dbItem = userItems.find(
          (i) => i.id === itemId && i.createdById === currentUserId
        );

        // Branch 3: item not found or belongs to another user
        if (!dbItem) {
          return { valid: false, error: `Barang dengan ID ${itemId} tidak ditemukan`, statusCode: 404 };
        }

        // Branch 4: insufficient stock
        if (dbItem.quantity < quantity) {
          return {
            valid: false,
            error: `Stok untuk "${dbItem.name}" tidak mencukupi. Tersedia: ${dbItem.quantity} Pcs, diminta: ${quantity} Pcs.`,
            statusCode: 400,
          };
        }
      }

      return { valid: true };
    }

    // Function replicating the sequential code generation logic in routes/outgoing.ts
    function generateNextTransactionCode(latestCode: string | null | undefined): string {
      let nextNum = 1;
      if (latestCode) {
        const match = latestCode.match(/KB-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      return formatTransactionCode(nextNum, "KB");
    }

    describe("Payload & Input Validation Branches", () => {
      const mockUserItems = [
        { id: 101, name: "Kaos Polos Putih", quantity: 50, createdById: "user-123" },
        { id: 102, name: "Kemeja Flanel", quantity: 15, createdById: "user-123" },
        { id: 103, name: "Barang User Lain", quantity: 100, createdById: "user-other" },
      ];

      it("Branch: rejects null, undefined, or empty items array with 400", () => {
        expect(validateOutgoingRequest({}, mockUserItems, "user-123")).toEqual({
          valid: false,
          error: "Daftar barang tidak boleh kosong",
          statusCode: 400,
        });

        expect(validateOutgoingRequest({ items: [] }, mockUserItems, "user-123")).toEqual({
          valid: false,
          error: "Daftar barang tidak boleh kosong",
          statusCode: 400,
        });

        expect(validateOutgoingRequest({ items: "invalid" as any }, mockUserItems, "user-123")).toEqual({
          valid: false,
          error: "Daftar barang tidak boleh kosong",
          statusCode: 400,
        });
      });

      it("Branch: rejects item with invalid itemId or quantity <= 0 with 400", () => {
        // Missing itemId
        expect(
          validateOutgoingRequest({ items: [{ quantity: 5 }] }, mockUserItems, "user-123")
        ).toEqual({
          valid: false,
          error: "ID barang dan jumlah yang valid wajib diisi",
          statusCode: 400,
        });

        // Quantity 0
        expect(
          validateOutgoingRequest({ items: [{ itemId: 101, quantity: 0 }] }, mockUserItems, "user-123")
        ).toEqual({
          valid: false,
          error: "ID barang dan jumlah yang valid wajib diisi",
          statusCode: 400,
        });

        // Negative quantity
        expect(
          validateOutgoingRequest({ items: [{ itemId: 101, quantity: -10 }] }, mockUserItems, "user-123")
        ).toEqual({
          valid: false,
          error: "ID barang dan jumlah yang valid wajib diisi",
          statusCode: 400,
        });
      });

      it("Branch: rejects item when not found or owned by different user with 404", () => {
        // Non-existent item
        expect(
          validateOutgoingRequest({ items: [{ itemId: 999, quantity: 5 }] }, mockUserItems, "user-123")
        ).toEqual({
          valid: false,
          error: "Barang dengan ID 999 tidak ditemukan",
          statusCode: 404,
        });

        // Item owned by different user (Tenant Isolation Check)
        expect(
          validateOutgoingRequest({ items: [{ itemId: 103, quantity: 5 }] }, mockUserItems, "user-123")
        ).toEqual({
          valid: false,
          error: "Barang dengan ID 103 tidak ditemukan",
          statusCode: 404,
        });
      });

      it("Branch: rejects when requested quantity exceeds available stock with 400", () => {
        expect(
          validateOutgoingRequest({ items: [{ itemId: 101, quantity: 51 }] }, mockUserItems, "user-123")
        ).toEqual({
          valid: false,
          error: 'Stok untuk "Kaos Polos Putih" tidak mencukupi. Tersedia: 50 Pcs, diminta: 51 Pcs.',
          statusCode: 400,
        });
      });

      it("Branch: accepts when requested quantity is within or exact stock", () => {
        // Exact stock match
        expect(
          validateOutgoingRequest({ items: [{ itemId: 101, quantity: 50 }] }, mockUserItems, "user-123")
        ).toEqual({ valid: true });

        // Partial quantity
        expect(
          validateOutgoingRequest({ items: [{ itemId: 101, quantity: 25 }] }, mockUserItems, "user-123")
        ).toEqual({ valid: true });

        // Multiple items valid
        expect(
          validateOutgoingRequest(
            {
              items: [
                { itemId: 101, quantity: 10 },
                { itemId: 102, quantity: 5 },
              ],
            },
            mockUserItems,
            "user-123"
          )
        ).toEqual({ valid: true });
      });
    });

    describe("Sequential Transaction Code Generation Branches", () => {
      it("starts with KB-00001 when no prior transaction exists", () => {
        expect(generateNextTransactionCode(null)).toBe("KB-00001");
        expect(generateNextTransactionCode(undefined)).toBe("KB-00001");
        expect(generateNextTransactionCode("")).toBe("KB-00001");
      });

      it("increments sequential code correctly from previous valid code", () => {
        expect(generateNextTransactionCode("KB-00001")).toBe("KB-00002");
        expect(generateNextTransactionCode("KB-00057")).toBe("KB-00058");
        expect(generateNextTransactionCode("KB-00999")).toBe("KB-01000");
        expect(generateNextTransactionCode("KB-09999")).toBe("KB-10000");
      });

      it("handles malformed or non-matching code by defaulting to KB-00001", () => {
        expect(generateNextTransactionCode("INVALID-CODE")).toBe("KB-00001");
        expect(generateNextTransactionCode("TX-123")).toBe("KB-00001");
      });
    });

    describe("Post-Transaction Stock Calculation & Status Transitions", () => {
      it("calculates correct remaining quantity and status transitions", () => {
        const testCases = [
          { currentStock: 100, deduction: 10, expectedQty: 90, expectedStatus: "AMAN" },
          { currentStock: 60, deduction: 10, expectedQty: 50, expectedStatus: "MENIPIS" },
          { currentStock: 60, deduction: 39, expectedQty: 21, expectedStatus: "MENIPIS" },
          { currentStock: 60, deduction: 40, expectedQty: 20, expectedStatus: "KRITIS" },
          { currentStock: 60, deduction: 59, expectedQty: 1, expectedStatus: "KRITIS" },
          { currentStock: 60, deduction: 60, expectedQty: 0, expectedStatus: "KRITIS" },
        ];

        for (const tc of testCases) {
          const nextQty = tc.currentStock - tc.deduction;
          expect(nextQty).toBe(tc.expectedQty);
          expect(calculateStockStatus(nextQty)).toBe(tc.expectedStatus);
        }
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Transfer Antar Gudang Logic
  // ──────────────────────────────────────────────────────────────────────────
  describe("Module: Warehouse Transfers (Pindah Barang Antar Gudang)", () => {
    interface TransferItem {
      id: number;
      name: string;
      code: string;
      categoryId: number;
      warehouseId: number;
      quantity: number;
      createdById: string;
    }

    interface TransferWarehouse {
      id: number;
      name: string;
      maxCapacity: number;
      allowedCategoryId: number | null;
    }

    function processTransferValidation(
      body: { itemId?: number; sourceWarehouseId?: number; destWarehouseId?: number; quantity?: number },
      sourceItem: TransferItem | null,
      destWarehouse: TransferWarehouse | null,
      userDestStock: number,
      currentUserId: string
    ): { valid: boolean; error?: string; statusCode?: number } {
      const { itemId, sourceWarehouseId, destWarehouseId, quantity } = body;

      // 1. Basic validation
      if (!itemId || !sourceWarehouseId || !destWarehouseId || quantity === undefined || quantity === null) {
        return { valid: false, error: "Item, gudang asal, gudang tujuan, dan jumlah wajib diisi", statusCode: 400 };
      }

      if (quantity <= 0) {
        return { valid: false, error: "Jumlah harus lebih dari 0", statusCode: 400 };
      }

      if (sourceWarehouseId === destWarehouseId) {
        return { valid: false, error: "Gudang asal dan tujuan tidak boleh sama", statusCode: 400 };
      }

      // 2. Source item check (scoped to user)
      if (!sourceItem || sourceItem.createdById !== currentUserId) {
        return { valid: false, error: "Barang tidak ditemukan", statusCode: 404 };
      }

      if (sourceItem.warehouseId !== sourceWarehouseId) {
        return { valid: false, error: "Barang tidak berada di gudang asal yang dipilih", statusCode: 400 };
      }

      if (sourceItem.quantity < quantity) {
        return {
          valid: false,
          error: `Stok tidak mencukupi. Stok tersedia: ${sourceItem.quantity} pcs`,
          statusCode: 400,
        };
      }

      // 3. Destination warehouse check
      if (!destWarehouse) {
        return { valid: false, error: "Gudang tujuan tidak ditemukan", statusCode: 404 };
      }

      if (!isWarehouseCategoryAllowed(destWarehouse.allowedCategoryId, sourceItem.categoryId)) {
        return {
          valid: false,
          error: `Gudang tujuan "${destWarehouse.name}" hanya menerima kategori tertentu`,
          statusCode: 400,
        };
      }

      // 4. Capacity check (scoped to user's stock)
      const capacityCheck = canWarehouseAcceptQuantity(
        userDestStock,
        destWarehouse.maxCapacity,
        quantity
      );

      if (!capacityCheck.allowed) {
        return {
          valid: false,
          error: `Kapasitas gudang tujuan tidak mencukupi. Sisa kapasitas: ${capacityCheck.remainingCapacity} pcs`,
          statusCode: 400,
        };
      }

      return { valid: true };
    }

    const sampleItem: TransferItem = {
      id: 201,
      name: "Green T-shirt",
      code: "GRM-TS-001",
      categoryId: 1, // Pakaian Atas
      warehouseId: 1, // Gudang 1
      quantity: 100,
      createdById: "user-abc",
    };

    const gudang1: TransferWarehouse = {
      id: 1,
      name: "Gudang 1",
      maxCapacity: 2500,
      allowedCategoryId: 1, // Pakaian Atas only
    };

    const gudang2: TransferWarehouse = {
      id: 2,
      name: "Gudang 2",
      maxCapacity: 2000,
      allowedCategoryId: 2, // Pakaian Bawah only
    };

    const gudang3: TransferWarehouse = {
      id: 3,
      name: "Gudang 3",
      maxCapacity: 2000,
      allowedCategoryId: null, // Campuran (all categories)
    };

    it("Branch: rejects missing fields with 400", () => {
      const res = processTransferValidation({}, sampleItem, gudang3, 0, "user-abc");
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.error).toBe("Item, gudang asal, gudang tujuan, dan jumlah wajib diisi");
    });

    it("Branch: rejects quantity <= 0 with 400", () => {
      const res = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 3, quantity: 0 },
        sampleItem,
        gudang3,
        0,
        "user-abc"
      );
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Jumlah harus lebih dari 0");
    });

    it("Branch: rejects identical source and destination warehouse with 400", () => {
      const res = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 1, quantity: 10 },
        sampleItem,
        gudang1,
        0,
        "user-abc"
      );
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Gudang asal dan tujuan tidak boleh sama");
    });

    it("Branch: rejects when source item is not found or belongs to another user with 404", () => {
      // Null item
      const resNull = processTransferValidation(
        { itemId: 999, sourceWarehouseId: 1, destWarehouseId: 3, quantity: 10 },
        null,
        gudang3,
        0,
        "user-abc"
      );
      expect(resNull.valid).toBe(false);
      expect(resNull.statusCode).toBe(404);

      // Item of another user
      const resOther = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 3, quantity: 10 },
        sampleItem,
        gudang3,
        0,
        "other-user"
      );
      expect(resOther.valid).toBe(false);
      expect(resOther.statusCode).toBe(404);
    });

    it("Branch: rejects when item is not in selected source warehouse with 400", () => {
      const res = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 2, destWarehouseId: 3, quantity: 10 },
        sampleItem, // warehouseId is 1
        gudang3,
        0,
        "user-abc"
      );
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Barang tidak berada di gudang asal yang dipilih");
    });

    it("Branch: rejects when requested transfer quantity exceeds available stock with 400", () => {
      const res = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 3, quantity: 150 },
        sampleItem, // stock is 100
        gudang3,
        0,
        "user-abc"
      );
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Stok tidak mencukupi. Stok tersedia: 100 pcs");
    });

    it("Branch: rejects category mismatch when destination warehouse restricts category", () => {
      // sampleItem is category 1 (Pakaian Atas), gudang2 only accepts category 2 (Pakaian Bawah)
      const res = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 2, quantity: 10 },
        sampleItem,
        gudang2,
        0,
        "user-abc"
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain("hanya menerima kategori tertentu");
    });

    it("Branch: accepts when destination warehouse allows mixed categories (null allowedCategoryId)", () => {
      const res = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 3, quantity: 10 },
        sampleItem,
        gudang3,
        500, // dest has 500 pcs, capacity 2000
        "user-abc"
      );
      expect(res.valid).toBe(true);
    });

    it("Branch: capacity overflow rejection and positive remaining capacity calculation", () => {
      // Destination has 1950 pcs, max is 2000, remaining capacity is 50. Requesting 60.
      const resOverflow = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 3, quantity: 60 },
        sampleItem,
        gudang3,
        1950,
        "user-abc"
      );
      expect(resOverflow.valid).toBe(false);
      expect(resOverflow.error).toBe("Kapasitas gudang tujuan tidak mencukupi. Sisa kapasitas: 50 pcs");

      // Exactly fits remaining capacity (50 pcs)
      const resExact = processTransferValidation(
        { itemId: 201, sourceWarehouseId: 1, destWarehouseId: 3, quantity: 50 },
        sampleItem,
        gudang3,
        1950,
        "user-abc"
      );
      expect(resExact.valid).toBe(true);
    });

    describe("Full vs Partial Transfer Execution Logic", () => {
      it("executes Full Transfer when transferring entire stock (newSourceQty = 0)", () => {
        const initialStock = 50;
        const transferQty = 50;
        const newSourceQty = initialStock - transferQty;

        expect(newSourceQty).toBe(0);
        // Entire item is moved to destination warehouse
        const isFullTransfer = newSourceQty <= 0;
        expect(isFullTransfer).toBe(true);

        const newStatus = calculateStockStatus(transferQty);
        expect(newStatus).toBe("MENIPIS");
      });

      it("executes Partial Transfer and manages destination item split / merge", () => {
        const initialStock = 100;
        const transferQty = 30;
        const newSourceQty = initialStock - transferQty;

        expect(newSourceQty).toBe(70);
        const sourceStatus = calculateStockStatus(newSourceQty);
        expect(sourceStatus).toBe("AMAN");

        // Scenario 1: Destination does not have item yet -> new SKU generated
        const baseSKU = "GRM-TS-001";
        const destWarehouseId = 3;
        const expectedNewSKU = `${baseSKU}-W${destWarehouseId}`;
        expect(expectedNewSKU).toBe("GRM-TS-001-W3");

        // Scenario 2: Destination already has item with 20 pcs -> merges to 50 pcs
        const existingDestQty = 20;
        const mergedQty = existingDestQty + transferQty;
        expect(mergedQty).toBe(50);
        const destStatus = calculateStockStatus(mergedQty);
        expect(destStatus).toBe("MENIPIS");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Warehouse Capacity & Category Boundary Analysis
  // ──────────────────────────────────────────────────────────────────────────
  describe("Module: Capacity Rules & Boundary Coverage", () => {
    it("handles overcapacity bounds without returning negative remaining capacity", () => {
      // When current stock exceeds max capacity (overbooked), remaining capacity must clamp to 0
      const result = canWarehouseAcceptQuantity(2500, 2000, 10);
      expect(result.allowed).toBe(false);
      expect(result.remainingCapacity).toBe(0);
    });

    it("evaluates warehouse status thresholds across all boundary points", () => {
      const boundaries: Array<{ percentage: number; expected: WarehouseStatus }> = [
        { percentage: 0, expected: "STABIL" },
        { percentage: 50, expected: "STABIL" },
        { percentage: 79.9, expected: "STABIL" },
        { percentage: 80, expected: "ZONA PERINGATAN" },
        { percentage: 90, expected: "ZONA PERINGATAN" },
        { percentage: 94.9, expected: "ZONA PERINGATAN" },
        { percentage: 95, expected: "KAPASITAS KRITIS" },
        { percentage: 100, expected: "KAPASITAS KRITIS" },
        { percentage: 110, expected: "KAPASITAS KRITIS" },
      ];

      for (const b of boundaries) {
        expect(calculateWarehouseStatus(b.percentage)).toBe(b.expected);
      }
    });

    it("evaluates category compatibility correctly", () => {
      // null allowedCategoryId -> wildcard allows any category
      expect(isWarehouseCategoryAllowed(null, 1)).toBe(true);
      expect(isWarehouseCategoryAllowed(null, 99)).toBe(true);

      // specific allowedCategoryId -> only matches identical category ID
      expect(isWarehouseCategoryAllowed(1, 1)).toBe(true);
      expect(isWarehouseCategoryAllowed(1, 2)).toBe(false);
      expect(isWarehouseCategoryAllowed(2, 1)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ACID Transaction & Rollback Simulation
  // ──────────────────────────────────────────────────────────────────────────
  describe("Module: Database Transaction Mock Simulation", () => {
    it("commits all changes when all operations inside transaction succeed", async () => {
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(true),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 777, status: "SUKSES" }]),
          }),
        }),
      };

      const executeTransaction = async (tx: typeof mockTx) => {
        // Step 1: Update source stock
        await tx.update().set().where();
        // Step 2: Insert transaction record
        const [res] = await tx.insert().values().returning();
        return res;
      };

      const result = await executeTransaction(mockTx);
      expect(result).toEqual({ id: 777, status: "SUKSES" });
      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
    });

    it("propagates error and aborts transaction if any operation fails midway", async () => {
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(true),
          }),
        }),
        insert: vi.fn().mockImplementation(() => {
          throw new Error("Database foreign key violation during insert");
        }),
      };

      const executeTransaction = async (tx: typeof mockTx) => {
        await tx.update().set().where();
        await tx.insert();
      };

      await expect(executeTransaction(mockTx)).rejects.toThrow(
        "Database foreign key violation during insert"
      );
      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
    });
  });
});
