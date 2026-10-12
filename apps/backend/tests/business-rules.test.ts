import { describe, it, expect } from "vitest";
import {
  calculateStockStatus,
  calculateWarehouseStatus,
  formatTransactionCode,
  isWarehouseCategoryAllowed,
  canWarehouseAcceptQuantity,
} from "../src/lib/businessRules.js";

describe("GarmentFlow V2 — Business Rules Suite", () => {
  describe("Stock Status Thresholds", () => {
    it("returns KRITIS for stock <= 20", () => {
      expect(calculateStockStatus(0)).toBe("KRITIS");
      expect(calculateStockStatus(1)).toBe("KRITIS");
      expect(calculateStockStatus(20)).toBe("KRITIS");
    });

    it("returns MENIPIS for stock between 21 and 50", () => {
      expect(calculateStockStatus(21)).toBe("MENIPIS");
      expect(calculateStockStatus(35)).toBe("MENIPIS");
      expect(calculateStockStatus(50)).toBe("MENIPIS");
    });

    it("returns AMAN for stock > 50", () => {
      expect(calculateStockStatus(51)).toBe("AMAN");
      expect(calculateStockStatus(100)).toBe("AMAN");
      expect(calculateStockStatus(500)).toBe("AMAN");
    });
  });

  describe("Warehouse Occupancy Status", () => {
    it("returns STABIL for capacity < 80%", () => {
      expect(calculateWarehouseStatus(0)).toBe("STABIL");
      expect(calculateWarehouseStatus(50)).toBe("STABIL");
      expect(calculateWarehouseStatus(79.9)).toBe("STABIL");
    });

    it("returns ZONA PERINGATAN for capacity between 80% and 94.9%", () => {
      expect(calculateWarehouseStatus(80)).toBe("ZONA PERINGATAN");
      expect(calculateWarehouseStatus(90)).toBe("ZONA PERINGATAN");
      expect(calculateWarehouseStatus(94.9)).toBe("ZONA PERINGATAN");
    });

    it("returns KAPASITAS KRITIS for capacity >= 95%", () => {
      expect(calculateWarehouseStatus(95)).toBe("KAPASITAS KRITIS");
      expect(calculateWarehouseStatus(99)).toBe("KAPASITAS KRITIS");
      expect(calculateWarehouseStatus(100)).toBe("KAPASITAS KRITIS");
    });
  });

  describe("Warehouse Category Constraints", () => {
    it("allows any category if warehouse allowedCategoryId is null (Gudang Campuran)", () => {
      expect(isWarehouseCategoryAllowed(null, 1)).toBe(true);
      expect(isWarehouseCategoryAllowed(null, 2)).toBe(true);
      expect(isWarehouseCategoryAllowed(null, 99)).toBe(true);
    });

    it("allows category only if it strictly matches allowedCategoryId", () => {
      expect(isWarehouseCategoryAllowed(1, 1)).toBe(true);
      expect(isWarehouseCategoryAllowed(2, 2)).toBe(true);
      expect(isWarehouseCategoryAllowed(1, 2)).toBe(false);
      expect(isWarehouseCategoryAllowed(2, 1)).toBe(false);
    });
  });

  describe("Warehouse Capacity Acceptance", () => {
    it("allows incoming transfer when quantity fits inside remaining capacity", () => {
      const result = canWarehouseAcceptQuantity(1500, 2000, 300);
      expect(result.allowed).toBe(true);
      expect(result.remainingCapacity).toBe(500);
    });

    it("rejects incoming transfer when quantity exceeds remaining capacity", () => {
      const result = canWarehouseAcceptQuantity(1800, 2000, 250);
      expect(result.allowed).toBe(false);
      expect(result.remainingCapacity).toBe(200);
    });

    it("handles zero remaining capacity gracefully", () => {
      const result = canWarehouseAcceptQuantity(2000, 2000, 10);
      expect(result.allowed).toBe(false);
      expect(result.remainingCapacity).toBe(0);
    });
  });

  describe("Transaction Serial Code Generation", () => {
    it("formats sequential transaction code with 5-digit padding", () => {
      expect(formatTransactionCode(1)).toBe("KB-00001");
      expect(formatTransactionCode(57)).toBe("KB-00057");
      expect(formatTransactionCode(999)).toBe("KB-00999");
      expect(formatTransactionCode(12345)).toBe("KB-12345");
    });

    it("supports custom prefix if needed", () => {
      expect(formatTransactionCode(1, "TRF")).toBe("TRF-00001");
    });
  });
});
