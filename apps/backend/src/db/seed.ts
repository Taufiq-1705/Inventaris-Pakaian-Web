import "dotenv/config";
import { db } from "./index.js";
import {
  user,
  category,
  itemType,
  warehouse,
  item,
  activityLog,
  transfer,
} from "./schema.js";
import { sql } from "drizzle-orm";

/**
 * Seed script — populates the database with structural data and testing dummy data per user.
 * Safe to run multiple times — cleans existing data first.
 *
 * Run with: npm run db:seed
 */
async function seed() {
  console.log("🌱 Seeding database...\n");

  // ─── Cleanup (in FK-safe order) ────────────────────────
  console.log("🧹 Cleaning existing data...");
  await db.delete(activityLog);
  await db.delete(transfer);
  await db.delete(item);
  await db.delete(warehouse);
  await db.delete(itemType);
  await db.delete(category);
  console.log("   ✓ All tables cleaned");

  // ─── Categories ────────────────────────────────────────
  console.log("📂 Inserting categories...");
  const [catTop, catBottom] = await db
    .insert(category)
    .values([
      { name: "Pakaian Atas", slug: "top" },
      { name: "Pakaian Bawah", slug: "bottom" },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`   ✓ Created ${catTop?.name ?? "Pakaian Atas"} & ${catBottom?.name ?? "Pakaian Bawah"}`);

  // ─── Item Types ────────────────────────────────────────
  console.log("📋 Inserting item types...");
  const topTypes = await db
    .insert(itemType)
    .values([
      { categoryId: catTop?.id ?? 1, name: "Kaos", slug: "kaos" },
      { categoryId: catTop?.id ?? 1, name: "Kemeja", slug: "kemeja" },
      { categoryId: catTop?.id ?? 1, name: "Polo", slug: "polo" },
      { categoryId: catTop?.id ?? 1, name: "Sweater", slug: "sweater" },
      { categoryId: catTop?.id ?? 1, name: "Hoodie", slug: "hoodie" },
    ])
    .onConflictDoNothing()
    .returning();

  const bottomTypes = await db
    .insert(itemType)
    .values([
      { categoryId: catBottom?.id ?? 2, name: "Celana Panjang", slug: "celana_panjang" },
      { categoryId: catBottom?.id ?? 2, name: "Celana Pendek", slug: "celana_pendek" },
      { categoryId: catBottom?.id ?? 2, name: "Jeans", slug: "jeans" },
      { categoryId: catBottom?.id ?? 2, name: "Rok", slug: "rok" },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`   ✓ Created ${topTypes.length + bottomTypes.length} item types`);

  // ─── Warehouses ────────────────────────────────────────
  console.log("🏭 Inserting warehouses...");
  const warehouses = await db
    .insert(warehouse)
    .values([
      {
        name: "Gudang 1",
        description: "Pakaian Atas (Kaos, Kemeja, Jaket)",
        locationLabel: "LOKASI A1-F12",
        maxCapacity: 2500,
        allowedCategoryId: catTop?.id ?? null,
      },
      {
        name: "Gudang 2",
        description: "Pakaian Bawah (Celana, Rok)",
        locationLabel: "LOKASI G1-J4",
        maxCapacity: 2000,
        allowedCategoryId: catBottom?.id ?? null,
      },
      {
        name: "Gudang 3",
        description: "Campuran (Pakaian Atas & Bawah)",
        locationLabel: "LOKASI K1-L2",
        maxCapacity: 2000,
        allowedCategoryId: null,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`   ✓ Created ${warehouses.length} warehouses`);

  // ─── Dummy Data per User ───────────────────────────────
  const usersList = await db.select().from(user);
  console.log(`👤 Found ${usersList.length} users in database. Seeding dummy items...`);

  const kaosType = topTypes.find((t) => t.name === "Kaos");
  const kemejaType = topTypes.find((t) => t.name === "Kemeja");
  const hoodieType = topTypes.find((t) => t.name === "Hoodie");
  const jeansType = bottomTypes.find((t) => t.name === "Jeans");
  const celanaType = bottomTypes.find((t) => t.name === "Celana Panjang");

  for (const currUser of usersList) {
    const userSuffix = currUser.id.slice(0, 4);
    console.log(`   ⚙  Seeding items for user: ${currUser.name} (${currUser.id})`);

    const userItems = await db
      .insert(item)
      .values([
        // --- Gudang 1: Pakaian Atas (Total: 1.500 Pcs) ---
        {
          code: `GRM-TS-001-${userSuffix}`,
          name: "Oversized Basic Tee White",
          categoryId: catTop?.id ?? 1,
          itemTypeId: kaosType?.id ?? 1,
          materialType: "Premium Cotton",
          size: "XL",
          quantity: 500,
          warehouseId: warehouses[0]?.id ?? 1,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          code: `GRM-KM-002-${userSuffix}`,
          name: "Flannel Plaid Shirt Burgundy",
          categoryId: catTop?.id ?? 1,
          itemTypeId: kemejaType?.id ?? 2,
          materialType: "Soft Flannel",
          size: "L",
          quantity: 400,
          warehouseId: warehouses[0]?.id ?? 1,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        },
        {
          code: `GRM-HD-003-${userSuffix}`,
          name: "Classic Pullover Hoodie Black",
          categoryId: catTop?.id ?? 1,
          itemTypeId: hoodieType?.id ?? 5,
          materialType: "Fleece Blend",
          size: "XL",
          quantity: 600,
          warehouseId: warehouses[0]?.id ?? 1,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },

        // --- Gudang 2: Pakaian Bawah (Total: 800 Pcs) ---
        {
          code: `GRM-JN-004-${userSuffix}`,
          name: "Straight Raw Denim Jeans Blue",
          categoryId: catBottom?.id ?? 2,
          itemTypeId: jeansType?.id ?? 8,
          materialType: "Raw Denim 14oz",
          size: "L",
          quantity: 450,
          warehouseId: warehouses[1]?.id ?? 2,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          code: `GRM-CP-005-${userSuffix}`,
          name: "Slim Fit Chino Pants Khaki",
          categoryId: catBottom?.id ?? 2,
          itemTypeId: celanaType?.id ?? 6,
          materialType: "Stretch Twill",
          size: "M",
          quantity: 350,
          warehouseId: warehouses[1]?.id ?? 2,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },

        // --- Gudang 3: Campuran (Total: 1.800 Pcs) ---
        {
          code: `GRM-TS-006-${userSuffix}`,
          name: "Vintage Graphic Tee Black",
          categoryId: catTop?.id ?? 1,
          itemTypeId: kaosType?.id ?? 1,
          materialType: "Heavyweight Cotton",
          size: "XL",
          quantity: 500,
          warehouseId: warehouses[2]?.id ?? 3,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        },
        {
          code: `GRM-JN-007-${userSuffix}`,
          name: "Relaxed Fit Denim Shorts Indigo",
          categoryId: catBottom?.id ?? 2,
          itemTypeId: jeansType?.id ?? 8,
          materialType: "Lightweight Denim",
          size: "L",
          quantity: 600,
          warehouseId: warehouses[2]?.id ?? 3,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        },
        {
          code: `GRM-HD-008-${userSuffix}`,
          name: "Unisex Crewneck Sweater Grey",
          categoryId: catTop?.id ?? 1,
          itemTypeId: hoodieType?.id ?? 5,
          materialType: "French Terry",
          size: "M",
          quantity: 300,
          warehouseId: warehouses[2]?.id ?? 3,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
        {
          code: `GRM-CP-009-${userSuffix}`,
          name: "Cargo Pants Olive Green",
          categoryId: catBottom?.id ?? 2,
          itemTypeId: celanaType?.id ?? 6,
          materialType: "Ripstop Cotton",
          size: "L",
          quantity: 400,
          warehouseId: warehouses[2]?.id ?? 3,
          status: "AMAN",
          createdById: currUser.id,
          entryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      ])
      .onConflictDoNothing()
      .returning();

    if (userItems.length > 0) {
      await db.insert(activityLog).values([
        // Bulan lalu (Arus barang bulanan)
        {
          type: "MASUK",
          itemId: userItems[0].id,
          warehouseId: warehouses[0].id,
          quantity: 600,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          type: "KELUAR",
          itemId: userItems[0].id,
          warehouseId: warehouses[0].id,
          quantity: 100,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        },
        {
          type: "MASUK",
          itemId: userItems[3].id,
          warehouseId: warehouses[1].id,
          quantity: 500,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          type: "KELUAR",
          itemId: userItems[3].id,
          warehouseId: warehouses[1].id,
          quantity: 50,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
        {
          type: "MASUK",
          itemId: userItems[5].id,
          warehouseId: warehouses[2].id,
          quantity: 600,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        },

        // 7 Hari Terakhir (Arus barang mingguan)
        {
          type: "MASUK",
          itemId: userItems[2].id,
          warehouseId: warehouses[0].id,
          quantity: 700,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        },
        {
          type: "KELUAR",
          itemId: userItems[2].id,
          warehouseId: warehouses[0].id,
          quantity: 100,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          type: "MASUK",
          itemId: userItems[4].id,
          warehouseId: warehouses[1].id,
          quantity: 400,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        },
        {
          type: "KELUAR",
          itemId: userItems[4].id,
          warehouseId: warehouses[1].id,
          quantity: 50,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          type: "MASUK",
          itemId: userItems[8].id,
          warehouseId: warehouses[2].id,
          quantity: 450,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          type: "KELUAR",
          itemId: userItems[8].id,
          warehouseId: warehouses[2].id,
          quantity: 50,
          createdById: currUser.id,
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ]);
    }
  }

  console.log("\n✅ Seed completed successfully!");
  console.log("   ℹ  Structural tables seeded.");
  console.log(`   ℹ  Dummy testing data created for all ${usersList.length} users.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
