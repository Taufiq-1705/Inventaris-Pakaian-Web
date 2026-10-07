export const API_BASE: string =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Generic fetch wrapper that:
 * - Prepends the API base URL
 * - Sets JSON headers
 * - Includes credentials (cookies for Better Auth)
 * - Parses the response as JSON
 * - Throws on non-OK responses with the server error message
 */
export async function api<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

// ─── Typed API helpers ───────────────────────────────────

// Dashboard
export interface DashboardStats {
  totalItems: number;
  totalStock: number;
  warehouses: WarehouseStats[];
}

export interface WarehouseStats {
  id: number;
  name: string;
  description: string | null;
  locationLabel: string | null;
  maxCapacity: number;
  allowedCategoryId: number | null;
  currentStock: number;
  percentage: number;
  status?: string;
  itemCount?: number;
  remainingCapacity?: number;
}

export interface ActivityEntry {
  id: number;
  type: "MASUK" | "KELUAR" | "PINDAH";
  itemName: string;
  itemCode: string;
  warehouseName: string;
  quantity: number;
  createdAt: string;
}

export interface ChartDataPoint {
  day: string;
  date: string;
  masuk: number;
  keluar: number;
}

// Items
export interface ItemData {
  id: number;
  code: string;
  name: string;
  materialType: string | null;
  size: string;
  quantity: number;
  status: string;
  notes: string | null;
  entryDate: string;
  categoryName: string | null;
  categoryId: number;
  typeName: string | null;
  warehouseName: string | null;
  warehouseId: number;
}

export interface ItemsResponse {
  items: ItemData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Categories
export interface CategoryType {
  id: number;
  name: string;
  slug: string;
}

export interface CategoryData {
  id: number;
  name: string;
  slug: string;
  types: CategoryType[];
}

// Transfers
export interface TransferData {
  id: number;
  quantity: number;
  status: string;
  createdAt: string;
  item: { id: number; name: string; code: string };
  sourceWarehouse: { id: number; name: string };
  destWarehouse: { id: number; name: string };
  createdBy: { id: string; name: string } | null;
}

// Profile
export interface ProfileData {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStats {
  totalActivities: number;
  totalTransfers: number;
  totalReports: number;
}

// Outgoing History Entry
export interface OutgoingHistoryEntry {
  id: number;
  date: string;
  transactionCode: string;
  type: "MASUK" | "KELUAR";
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  remainingStock: number;
}

export interface OutgoingHistoryResponse {
  history: OutgoingHistoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
