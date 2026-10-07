import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  serial,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// Better Auth Tables (user, session, account)
// These are required by Better Auth with specific column names.
// We extend `user` with extra fields: username, phone.
// ============================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Extended fields
  username: text("username").unique(),
  phone: text("phone"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================
// Application Tables
// ============================================================

// --- Category ---
export const category = pgTable("category", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Pakaian Atas"
  slug: text("slug").notNull().unique(), // e.g. "top"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Item Type (sub-category) ---
export const itemType = pgTable("item_type", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Kaos", "Kemeja"
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Warehouse ---
export const warehouse = pgTable("warehouse", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Gudang 1"
  description: text("description"), // e.g. "Pakaian Atas (Kaos, Kemeja, Jaket)"
  locationLabel: text("location_label"), // e.g. "LOKASI A1-F12"
  maxCapacity: integer("max_capacity").notNull().default(1000),
  allowedCategoryId: integer("allowed_category_id").references(() => category.id),
  // null = menerima semua kategori (Gudang 3)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- Item (inventory product) ---
export const item = pgTable("item", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "GRM-TS-001"
  name: text("name").notNull(), // e.g. "Oversized Basic Tee White"
  categoryId: integer("category_id")
    .notNull()
    .references(() => category.id),
  itemTypeId: integer("item_type_id")
    .notNull()
    .references(() => itemType.id),
  materialType: text("material_type"), // e.g. "Premium Cotton"
  size: text("size").notNull(), // e.g. "S", "M", "L", "XL", "ALL", "32"
  quantity: integer("quantity").notNull().default(0),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => warehouse.id),
  notes: text("notes"),
  status: text("status").notNull().default("AMAN"), // AMAN | MENIPIS | KRITIS
  createdById: text("created_by_id").references(() => user.id),
  entryDate: timestamp("entry_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // item.code already indexed via .unique()
  nameIdx: index("item_name_idx").on(table.name),
  warehouseIdx: index("item_warehouse_id_idx").on(table.warehouseId),
  createdByIdx: index("item_created_by_id_idx").on(table.createdById),
}));

// --- Transfer ---
export const transfer = pgTable("transfer", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => item.id),
  sourceWarehouseId: integer("source_warehouse_id")
    .notNull()
    .references(() => warehouse.id),
  destWarehouseId: integer("dest_warehouse_id")
    .notNull()
    .references(() => warehouse.id),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | SUKSES | GAGAL
  createdById: text("created_by_id").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Outgoing Transaction ---
export const outgoingTransaction = pgTable("outgoing_transaction", {
  id: serial("id").primaryKey(),
  transactionCode: text("transaction_code").notNull(), // e.g. "KB-00056"
  date: timestamp("date").notNull().defaultNow(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  transactionUserUnique: unique("transaction_user_unique").on(table.transactionCode, table.createdById),
}));

// --- Outgoing Transaction Item ---
export const outgoingTransactionItem = pgTable("outgoing_transaction_item", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id")
    .notNull()
    .references(() => outgoingTransaction.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => item.id),
  quantity: integer("quantity").notNull(),   // Jumlah yang dikeluarkan
  unit: text("unit").notNull().default("Pcs"),
});

// --- Activity Log ---
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // MASUK | KELUAR | PINDAH
  itemId: integer("item_id")
    .notNull()
    .references(() => item.id),
  warehouseId: integer("warehouse_id").references(() => warehouse.id),
  transferId: integer("transfer_id").references(() => transfer.id),
  outgoingTransactionId: integer("outgoing_transaction_id").references(() => outgoingTransaction.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  createdById: text("created_by_id").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// Relations (for Drizzle relational queries)
// ============================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  items: many(item),
  transfers: many(transfer),
  activityLogs: many(activityLog),
  outgoingTransactions: many(outgoingTransaction),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  itemTypes: many(itemType),
  items: many(item),
}));

export const itemTypeRelations = relations(itemType, ({ one, many }) => ({
  category: one(category, {
    fields: [itemType.categoryId],
    references: [category.id],
  }),
  items: many(item),
}));

export const warehouseRelations = relations(warehouse, ({ many }) => ({
  items: many(item),
  outgoingTransfers: many(transfer, { relationName: "sourceWarehouse" }),
  incomingTransfers: many(transfer, { relationName: "destWarehouse" }),
}));

export const itemRelations = relations(item, ({ one, many }) => ({
  category: one(category, {
    fields: [item.categoryId],
    references: [category.id],
  }),
  itemType: one(itemType, {
    fields: [item.itemTypeId],
    references: [itemType.id],
  }),
  warehouse: one(warehouse, {
    fields: [item.warehouseId],
    references: [warehouse.id],
  }),
  createdBy: one(user, { fields: [item.createdById], references: [user.id] }),
  activityLogs: many(activityLog),
}));

export const transferRelations = relations(transfer, ({ one, many }) => ({
  item: one(item, { fields: [transfer.itemId], references: [item.id] }),
  sourceWarehouse: one(warehouse, {
    fields: [transfer.sourceWarehouseId],
    references: [warehouse.id],
    relationName: "sourceWarehouse",
  }),
  destWarehouse: one(warehouse, {
    fields: [transfer.destWarehouseId],
    references: [warehouse.id],
    relationName: "destWarehouse",
  }),
  createdBy: one(user, {
    fields: [transfer.createdById],
    references: [user.id],
  }),
  activityLogs: many(activityLog),
}));

export const outgoingTransactionRelations = relations(outgoingTransaction, ({ one, many }) => ({
  createdBy: one(user, { fields: [outgoingTransaction.createdById], references: [user.id] }),
  items: many(outgoingTransactionItem),
  activityLogs: many(activityLog),
}));

export const outgoingTransactionItemRelations = relations(outgoingTransactionItem, ({ one }) => ({
  transaction: one(outgoingTransaction, { fields: [outgoingTransactionItem.transactionId], references: [outgoingTransaction.id] }),
  item: one(item, { fields: [outgoingTransactionItem.itemId], references: [item.id] }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  item: one(item, { fields: [activityLog.itemId], references: [item.id] }),
  warehouse: one(warehouse, {
    fields: [activityLog.warehouseId],
    references: [warehouse.id],
  }),
  transfer: one(transfer, {
    fields: [activityLog.transferId],
    references: [transfer.id],
  }),
  outgoingTransaction: one(outgoingTransaction, {
    fields: [activityLog.outgoingTransactionId],
    references: [outgoingTransaction.id],
  }),
  createdBy: one(user, {
    fields: [activityLog.createdById],
    references: [user.id],
  }),
}));
