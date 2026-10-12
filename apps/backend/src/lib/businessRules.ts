/**
 * Core business rules for inventory, warehouses, and transactions.
 * Extracted pure functions to ensure consistency across routes and tests.
 */

export type StockStatus = "AMAN" | "MENIPIS" | "KRITIS";
export type WarehouseStatus = "STABIL" | "ZONA PERINGATAN" | "KAPASITAS KRITIS";

/**
 * Calculates item stock status according to standard thresholds:
 * - <= 20 Pcs: KRITIS (Critical)
 * - 21..50 Pcs: MENIPIS (Low)
 * - > 50 Pcs: AMAN (Safe)
 */
export function calculateStockStatus(quantity: number): StockStatus {
  if (quantity <= 20) return "KRITIS";
  if (quantity <= 50) return "MENIPIS";
  return "AMAN";
}

/**
 * Calculates warehouse capacity occupancy level:
 * - >= 95%: KAPASITAS KRITIS
 * - >= 80%: ZONA PERINGATAN
 * - < 80%: STABIL
 */
export function calculateWarehouseStatus(percentage: number): WarehouseStatus {
  if (percentage >= 95) return "KAPASITAS KRITIS";
  if (percentage >= 80) return "ZONA PERINGATAN";
  return "STABIL";
}

/**
 * Generates formatted serial transaction codes (e.g., KB-00001, KB-00057)
 */
export function formatTransactionCode(nextNumber: number, prefix: string = "KB"): string {
  return `${prefix}-${String(Math.max(1, nextNumber)).padStart(5, "0")}`;
}

/**
 * Checks if a warehouse can accept a specific item category:
 * - null allowedCategoryId means mixed / all categories accepted
 * - non-null must match itemCategoryId
 */
export function isWarehouseCategoryAllowed(
  warehouseAllowedCategoryId: number | null,
  itemCategoryId: number
): boolean {
  if (warehouseAllowedCategoryId === null) return true;
  return warehouseAllowedCategoryId === itemCategoryId;
}

/**
 * Checks if a warehouse has enough capacity for an incoming transfer/entry.
 */
export function canWarehouseAcceptQuantity(
  currentStock: number,
  maxCapacity: number,
  incomingQuantity: number
): { allowed: boolean; remainingCapacity: number } {
  const remainingCapacity = Math.max(0, maxCapacity - currentStock);
  return {
    allowed: incomingQuantity <= remainingCapacity,
    remainingCapacity,
  };
}
