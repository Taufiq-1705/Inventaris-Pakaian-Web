import { describe, it, expect, vi, afterEach } from "vitest";
import {
  executeOutgoingTransaction,
  TransactionValidationError,
} from "../src/lib/transactionService.js";
import {
  item,
  outgoingTransaction,
  outgoingTransactionItem,
  activityLog,
} from "../src/db/schema.js";
import { PgDialect } from "drizzle-orm/pg-core";

// ============================================================================
// White-Box Unit Test: executeOutgoingTransaction (src/lib/transactionService.ts)
//
// Target: Statement + Branch coverage atas seluruh basis path:
//   V  = guard clause validasi input
//   L  = strategi lookup barang pada pre-check (findMany / findFirst / none)
//   B  = boundary kecukupan stok (pre-check)
//   C  = penomoran kode transaksi (sequence & fallback)
//   S  = jalur sukses + COMMIT
//   R  = kegagalan di dalam transaksi + ROLLBACK
//   K  = regresi cacat K1 (oversell baris duplikat) & K2 (TOCTOU) yang sudah diperbaiki
// ============================================================================

const USER_ID = "user-test-uuid";

type CatalogItem = { id: number; name: string; quantity: number; warehouseId: number };

interface HarnessOptions {
  /** Snapshot barang yang dibaca saat pre-check (di luar transaksi). */
  catalog?: CatalogItem[];
  /** Snapshot barang hasil SELECT ... FOR UPDATE di dalam transaksi (default = catalog). */
  txCatalog?: CatalogItem[];
  /** Kode transaksi terakhir untuk fallback SELECT (null = belum ada transaksi). */
  latestCode?: string | null;
  /** API relational query yang tersedia pada mock untuk pre-check. */
  lookup?: "findMany" | "findFirst" | "none";
}

const DEFAULT_CATALOG: CatalogItem[] = [
  { id: 1, name: "Kemeja Oxford", quantity: 50, warehouseId: 1 },
];

/**
 * Membangun mock Drizzle yang setia pada semantik transaksi driver postgres-js:
 *   db.transaction(cb) -> BEGIN; cb resolve => COMMIT; cb throw => ROLLBACK + rethrow.
 * `lifecycle` merekam BEGIN/COMMIT/ROLLBACK, `writes` merekam semua tulisan ke DB.
 */
function createHarness(opts: HarnessOptions = {}) {
  const catalog = opts.catalog ?? DEFAULT_CATALOG;
  const txCatalog = opts.txCatalog ?? catalog;
  const latestCode = opts.latestCode === undefined ? "KB-00010" : opts.latestCode;
  const lookup = opts.lookup ?? "findMany";

  const lifecycle = { begin: vi.fn(), commit: vi.fn(), rollback: vi.fn() };
  const writes = {
    inserts: [] as Array<{ table: unknown; values: any }>,
    updates: [] as Array<{ table: unknown; set: any }>,
  };

  const buildItemQuery = (source: CatalogItem[]): Record<string, any> => {
    if (lookup === "findMany") return { findMany: vi.fn().mockResolvedValue([...source]) };
    if (lookup === "findFirst") {
      // findFirst dipanggil sekali per itemId unik, berurutan sesuai request.
      const queue = [...source];
      return { findFirst: vi.fn(async () => queue.shift() ?? null) };
    }
    return {};
  };

  // Satu objek chain melayani dua query di dalam transaksi:
  //   lock     : select().from().where().orderBy().for("update") -> txCatalog
  //   fallback : select().from().where().orderBy().limit(1)      -> kode terakhir
  const tx: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    for: vi.fn().mockResolvedValue([...txCatalog]),
    limit: vi.fn().mockResolvedValue(latestCode ? [{ transactionCode: latestCode }] : []),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: any) => {
        writes.inserts.push({ table, values });
        return { returning: vi.fn().mockResolvedValue([{ id: 99, ...values }]) };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((set: any) => ({
        where: vi.fn(async () => {
          writes.updates.push({ table, set });
        }),
      })),
    })),
  };

  const db: any = {
    query: { item: buildItemQuery(catalog) },
    transaction: vi.fn(async (callback: (t: any) => Promise<unknown>) => {
      lifecycle.begin();
      try {
        const result = await callback(tx);
        lifecycle.commit();
        return result;
      } catch (err) {
        lifecycle.rollback(err);
        throw err;
      }
    }),
  };

  return { db, tx, lifecycle, writes };
}

const insertsInto = (writes: ReturnType<typeof createHarness>["writes"], table: unknown) =>
  writes.inserts.filter((w) => w.table === table);

async function expectValidationError(
  promise: Promise<unknown>,
  message: string | RegExp,
  statusCode: number
) {
  const err: any = await promise.then(
    () => {
      throw new Error("Expected promise to reject, but it resolved");
    },
    (e) => e
  );
  expect(err).toBeInstanceOf(TransactionValidationError);
  if (typeof message === "string") expect(err.message).toBe(message);
  else expect(err.message).toMatch(message);
  expect(err.statusCode).toBe(statusCode);
}

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Path V — Validasi input (guard clause, sebelum menyentuh DB)", () => {
  it.each([
    ["items undefined", { items: undefined }],
    ["items bukan array", { items: "1,2,3" }],
    ["items array kosong", { items: [] }],
  ])("V1 %s -> 400 'Daftar barang tidak boleh kosong'", async (_label, payload) => {
    const { db, lifecycle } = createHarness();

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, payload as any),
      "Daftar barang tidak boleh kosong",
      400
    );
    expect(db.query.item.findMany).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(lifecycle.begin).not.toHaveBeenCalled();
  });

  it.each([
    ["quantity = 0", { itemId: 1, quantity: 0 }],
    ["quantity negatif (-1)", { itemId: 1, quantity: -1 }],
    ["quantity negatif (-10)", { itemId: 1, quantity: -10 }],
    ["quantity undefined", { itemId: 1 }],
    ["quantity null", { itemId: 1, quantity: null }],
    ["itemId tidak ada", { quantity: 5 }],
    ["itemId = 0", { itemId: 0, quantity: 5 }],
  ])("V2 %s -> 400 'ID barang dan jumlah yang valid wajib diisi'", async (_label, line) => {
    const { db } = createHarness();

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, { items: [line as any] }),
      "ID barang dan jumlah yang valid wajib diisi",
      400
    );
    expect(db.query.item.findMany).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("V3 baris pertama valid tetapi baris kedua invalid -> tetap ditolak tanpa query DB", async () => {
    const { db } = createHarness();

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, {
        items: [
          { itemId: 1, quantity: 5 },
          { itemId: 2, quantity: 0 },
        ],
      }),
      "ID barang dan jumlah yang valid wajib diisi",
      400
    );
    expect(db.query.item.findMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Path B — Boundary kecukupan stok (pre-check di luar transaksi)", () => {
  it("B1 diminta = stok + 1 (51 > 50) -> 400 dengan pesan spesifik, transaksi tidak dibuka", async () => {
    const { db, lifecycle, writes } = createHarness();

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 51 }] }),
      'Stok untuk "Kemeja Oxford" tidak mencukupi. Tersedia: 50 Pcs, diminta: 51 Pcs.',
      400
    );
    expect(db.transaction).not.toHaveBeenCalled();
    expect(lifecycle.begin).not.toHaveBeenCalled();
    expect(writes.inserts).toHaveLength(0);
    expect(writes.updates).toHaveLength(0);
  });

  it("B2 diminta = stok (50 == 50) -> sukses, stok menjadi 0 berstatus KRITIS", async () => {
    const { db, lifecycle, writes } = createHarness();

    await executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 50 }] });

    expect(lifecycle.commit).toHaveBeenCalledTimes(1);
    expect(writes.updates[0].set).toMatchObject({ quantity: 0, status: "KRITIS" });
  });

  it("B3 diminta = stok - 1 (49 < 50) -> sukses, sisa stok 1", async () => {
    const { db, writes } = createHarness();

    await executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 49 }] });

    expect(writes.updates[0].set.quantity).toBe(1);
  });

  it("B4 barang tidak ditemukan / milik user lain (query kosong) -> 404", async () => {
    const { db } = createHarness({ catalog: [] });

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 999, quantity: 5 }] }),
      "Barang dengan ID 999 tidak ditemukan",
      404
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("B5 multi-barang: barang kedua melebihi stok -> seluruh transaksi ditolak", async () => {
    const { db } = createHarness({
      catalog: [
        { id: 1, name: "Kemeja Oxford", quantity: 50, warehouseId: 1 },
        { id: 2, name: "Celana Chino", quantity: 10, warehouseId: 1 },
      ],
    });

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, {
        items: [
          { itemId: 1, quantity: 5 },
          { itemId: 2, quantity: 11 },
        ],
      }),
      'Stok untuk "Celana Chino" tidak mencukupi. Tersedia: 10 Pcs, diminta: 11 Pcs.',
      400
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Path S — Skenario sukses & COMMIT", () => {
  it("S1 input valid + stok cukup -> header, detail, update stok, log; COMMIT tanpa ROLLBACK", async () => {
    const { db, tx, lifecycle, writes } = createHarness();

    const result = await executeOutgoingTransaction(db, USER_ID, {
      date: "2026-10-15T00:00:00.000Z",
      items: [{ itemId: 1, quantity: 10 }],
    });

    // Hasil
    expect(result).toMatchObject({
      transactionCode: "KB-00011",
      transactionId: 99,
      itemsProcessed: 1,
    });

    // Siklus transaksi
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(lifecycle.begin).toHaveBeenCalledTimes(1);
    expect(lifecycle.commit).toHaveBeenCalledTimes(1);
    expect(lifecycle.rollback).not.toHaveBeenCalled();

    // Baris barang dikunci (FOR UPDATE) SEBELUM tulisan pertama
    expect(tx.for).toHaveBeenCalledWith("update");
    expect(tx.for.mock.invocationCallOrder[0]).toBeLessThan(
      tx.insert.mock.invocationCallOrder[0]
    );

    // Urutan & target tabel insert: header -> detail -> activity log
    expect(writes.inserts.map((w) => w.table)).toEqual([
      outgoingTransaction,
      outgoingTransactionItem,
      activityLog,
    ]);
    expect(writes.inserts[0].values).toMatchObject({
      transactionCode: "KB-00011",
      createdById: USER_ID,
    });
    expect(insertsInto(writes, outgoingTransactionItem)[0].values).toEqual([
      { transactionId: 99, itemId: 1, quantity: 10, unit: "Pcs" },
    ]);
    expect(insertsInto(writes, activityLog)[0].values).toEqual([
      expect.objectContaining({
        type: "KELUAR",
        itemId: 1,
        warehouseId: 1,
        outgoingTransactionId: 99,
        quantity: 10,
        createdById: USER_ID,
      }),
    ]);

    // Pemotongan stok: 50 - 10 = 40 -> MENIPIS
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(writes.updates[0].table).toBe(item);
    expect(writes.updates[0].set).toMatchObject({ quantity: 40, status: "MENIPIS" });
  });

  it("S2 payload.date diisi -> dipakai untuk header & activity log", async () => {
    const { db, writes } = createHarness();
    const date = "2026-10-15T00:00:00.000Z";

    await executeOutgoingTransaction(db, USER_ID, { date, items: [{ itemId: 1, quantity: 1 }] });

    expect(writes.inserts[0].values.date).toEqual(new Date(date));
    expect(insertsInto(writes, activityLog)[0].values[0].createdAt).toEqual(new Date(date));
  });

  it("S3 payload.date kosong -> memakai waktu sistem saat ini", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-10-23T07:00:00.000Z");
    vi.setSystemTime(now);
    const { db, writes } = createHarness();

    await executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 1 }] });

    expect(writes.inserts[0].values.date).toEqual(now);
  });

  it("S4 multi-barang -> 1 bulk read, batch insert, status stok AMAN/MENIPIS/KRITIS", async () => {
    const catalog = [
      { id: 10, name: "Kemeja Putih", quantity: 100, warehouseId: 1 },
      { id: 20, name: "Celana Chino", quantity: 60, warehouseId: 1 },
      { id: 30, name: "Jaket Denim", quantity: 25, warehouseId: 2 },
    ];
    const { db, tx, writes } = createHarness({ catalog });

    const result = await executeOutgoingTransaction(db, USER_ID, {
      items: [
        { itemId: 10, quantity: 10 }, // 90 -> AMAN
        { itemId: 20, quantity: 20 }, // 40 -> MENIPIS
        { itemId: 30, quantity: 10 }, // 15 -> KRITIS
      ],
    });

    expect(result.itemsProcessed).toBe(3);
    expect(db.query.item.findMany).toHaveBeenCalledTimes(1);
    expect(tx.for).toHaveBeenCalledTimes(1); // 1 lock query untuk semua barang

    // header (1) + batch detail (1) + batch log (1)
    expect(tx.insert).toHaveBeenCalledTimes(3);
    expect(insertsInto(writes, outgoingTransactionItem)[0].values).toHaveLength(3);
    expect(insertsInto(writes, activityLog)[0].values.map((l: any) => l.warehouseId)).toEqual([
      1, 1, 2,
    ]);

    expect(writes.updates.map((u) => u.set)).toEqual([
      expect.objectContaining({ quantity: 90, status: "AMAN" }),
      expect.objectContaining({ quantity: 40, status: "MENIPIS" }),
      expect.objectContaining({ quantity: 15, status: "KRITIS" }),
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Path R — Kegagalan di dalam transaksi memicu ROLLBACK (mock db.transaction)", () => {
  it("R1 insert detail gagal -> ROLLBACK, tidak ada COMMIT, stok tidak disentuh", async () => {
    const { db, tx, lifecycle, writes } = createHarness();
    const dbError = new Error("Postgres connection reset during insert");
    const passthrough = tx.insert.getMockImplementation()!;
    tx.insert
      .mockImplementationOnce(passthrough) // header OK
      .mockImplementationOnce(() => {
        throw dbError; // detail gagal
      });

    await expect(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 5 }] })
    ).rejects.toBe(dbError);

    expect(lifecycle.rollback).toHaveBeenCalledTimes(1);
    expect(lifecycle.rollback).toHaveBeenCalledWith(dbError);
    expect(lifecycle.commit).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(insertsInto(writes, activityLog)).toHaveLength(0);
  });

  it("R2 update stok barang ke-2 gagal -> ROLLBACK membatalkan update barang ke-1", async () => {
    const { db, tx, lifecycle, writes } = createHarness({
      catalog: [
        { id: 1, name: "Kemeja Oxford", quantity: 50, warehouseId: 1 },
        { id: 2, name: "Celana Chino", quantity: 50, warehouseId: 1 },
      ],
    });
    const passthrough = tx.update.getMockImplementation()!;
    tx.update.mockImplementationOnce(passthrough).mockImplementationOnce(() => {
      throw new Error("deadlock detected");
    });

    await expect(
      executeOutgoingTransaction(db, USER_ID, {
        items: [
          { itemId: 1, quantity: 5 },
          { itemId: 2, quantity: 5 },
        ],
      })
    ).rejects.toThrow("deadlock detected");

    // Satu tulisan parsial sudah terjadi -> hanya ROLLBACK yang menjamin atomisitas
    expect(writes.updates).toHaveLength(1);
    expect(lifecycle.rollback).toHaveBeenCalledTimes(1);
    expect(lifecycle.commit).not.toHaveBeenCalled();
    expect(insertsInto(writes, activityLog)).toHaveLength(0);
  });

  it("R3 insert activity log (langkah terakhir) gagal -> ROLLBACK walau stok sudah di-update", async () => {
    const { db, tx, lifecycle, writes } = createHarness();
    const passthrough = tx.insert.getMockImplementation()!;
    tx.insert
      .mockImplementationOnce(passthrough) // header
      .mockImplementationOnce(passthrough) // detail
      .mockImplementationOnce(() => {
        throw new Error("activity_log insert violates constraint");
      });

    await expect(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 5 }] })
    ).rejects.toThrow("activity_log insert violates constraint");

    expect(writes.updates).toHaveLength(1);
    expect(lifecycle.rollback).toHaveBeenCalledTimes(1);
    expect(lifecycle.commit).not.toHaveBeenCalled();
  });

  it("R4 barang hilang di tengah transaksi -> Error generik + ROLLBACK, belum ada tulisan", async () => {
    const { db, lifecycle, writes } = createHarness({ txCatalog: [] });

    const err: any = await executeOutgoingTransaction(db, USER_ID, {
      items: [{ itemId: 1, quantity: 5 }],
    }).catch((e) => e);

    expect(err.message).toBe("Barang tidak ditemukan di tengah transaksi");
    // Bukan TransactionValidationError -> controller akan memetakan ke HTTP 500
    expect(err).not.toBeInstanceOf(TransactionValidationError);
    // Lock + validasi berjalan sebelum header di-insert
    expect(writes.inserts).toHaveLength(0);
    expect(lifecycle.rollback).toHaveBeenCalledWith(err);
    expect(lifecycle.commit).not.toHaveBeenCalled();
  });

  it("R5 kegagalan validasi tidak pernah membuka transaksi (tidak ada yang perlu di-rollback)", async () => {
    const { db, lifecycle } = createHarness();

    await expect(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: -3 }] })
    ).rejects.toBeInstanceOf(TransactionValidationError);

    expect(lifecycle.begin).not.toHaveBeenCalled();
    expect(lifecycle.rollback).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Path C — Penomoran kode transaksi (sequence & fallback)", () => {
  const run = (h: ReturnType<typeof createHarness>) =>
    executeOutgoingTransaction(h.db, USER_ID, { items: [{ itemId: 1, quantity: 1 }] });

  it("C1 sequence mengembalikan { rows: [...] } -> KB-00042, fallback SELECT tidak dipanggil", async () => {
    const h = createHarness();
    h.tx.execute = vi.fn().mockResolvedValue({ rows: [{ next_val: "42" }] });

    const result = await run(h);

    expect(h.tx.execute).toHaveBeenCalledTimes(1);
    expect(result.transactionCode).toBe("KB-00042");
    expect(h.tx.limit).not.toHaveBeenCalled(); // fallback SELECT tidak dijalankan
  });

  it("C2 sequence mengembalikan array (bentuk asli postgres-js) -> KB-00007", async () => {
    const h = createHarness();
    h.tx.execute = vi.fn().mockResolvedValue([{ next_val: 7 }]);

    const result = await run(h);

    expect(result.transactionCode).toBe("KB-00007");
    expect(h.tx.limit).not.toHaveBeenCalled();
  });

  it("C3 sequence mengembalikan baris kosong -> fallback SELECT -> KB-00011", async () => {
    const h = createHarness();
    h.tx.execute = vi.fn().mockResolvedValue({ rows: [] });

    const result = await run(h);

    expect(h.tx.limit).toHaveBeenCalledTimes(1);
    expect(result.transactionCode).toBe("KB-00011");
  });

  it("C4 sequence melempar error -> ditelan, fallback SELECT -> KB-00011", async () => {
    const h = createHarness();
    h.tx.execute = vi
      .fn()
      .mockRejectedValue(new Error("relation 'outgoing_tx_seq' does not exist"));

    const result = await run(h);

    expect(h.tx.execute).toHaveBeenCalledTimes(1);
    expect(h.tx.limit).toHaveBeenCalledTimes(1);
    expect(result.transactionCode).toBe("KB-00011");
  });

  it("C5 tanpa tx.execute & belum ada transaksi sebelumnya -> KB-00001", async () => {
    const result = await run(createHarness({ latestCode: null }));
    expect(result.transactionCode).toBe("KB-00001");
  });

  it("C6 kode terakhir tidak cocok pola KB-(\\d+) -> mulai dari KB-00001", async () => {
    const result = await run(createHarness({ latestCode: "LEGACY-77" }));
    expect(result.transactionCode).toBe("KB-00001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Path L — Strategi lookup barang pada pre-check (findMany vs fallback findFirst)", () => {
  it("L1 hanya findFirst tersedia -> loop per itemId unik, lalu 1 lock query di transaksi", async () => {
    const catalog = [
      { id: 1, name: "Kemeja Oxford", quantity: 50, warehouseId: 1 },
      { id: 2, name: "Celana Chino", quantity: 30, warehouseId: 1 },
    ];
    const { db, tx, lifecycle } = createHarness({ catalog, lookup: "findFirst" });

    const result = await executeOutgoingTransaction(db, USER_ID, {
      items: [
        { itemId: 1, quantity: 5 },
        { itemId: 2, quantity: 5 },
      ],
    });

    expect(result.itemsProcessed).toBe(2);
    expect(db.query.item.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.for).toHaveBeenCalledTimes(1);
    expect(lifecycle.commit).toHaveBeenCalledTimes(1);
  });

  it("L2 findFirst mengembalikan null -> barang dilewati -> 404", async () => {
    const { db } = createHarness({ catalog: [], lookup: "findFirst" });

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 5, quantity: 1 }] }),
      "Barang dengan ID 5 tidak ditemukan",
      404
    );
  });

  it("L3 tidak ada API query sama sekali -> dbItems kosong -> 404", async () => {
    const { db } = createHarness({ lookup: "none" });

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 1 }] }),
      "Barang dengan ID 1 tidak ditemukan",
      404
    );
  });

  it("L4 itemId duplikat di request -> dikonsolidasi sehingga hanya 1 lookup", async () => {
    const { db } = createHarness({ lookup: "findFirst" });

    await executeOutgoingTransaction(db, USER_ID, {
      items: [
        { itemId: 1, quantity: 5 },
        { itemId: 1, quantity: 5 },
      ],
    });

    expect(db.query.item.findFirst).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regresi untuk cacat yang ditemukan pada analisis white-box dan sudah diperbaiki.
// ─────────────────────────────────────────────────────────────────────────────
describe("Path K — Regresi cacat K1 (oversell) & K2 (TOCTOU)", () => {
  it("K1a baris duplikat itemId sama melebihi stok bila dijumlahkan (30+30 > 50) -> 400", async () => {
    const { db, lifecycle } = createHarness();

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, {
        items: [
          { itemId: 1, quantity: 30 },
          { itemId: 1, quantity: 30 },
        ],
      }),
      'Stok untuk "Kemeja Oxford" tidak mencukupi. Tersedia: 50 Pcs, diminta: 60 Pcs.',
      400
    );
    expect(db.transaction).not.toHaveBeenCalled();
    expect(lifecycle.begin).not.toHaveBeenCalled();
  });

  it("K1b baris duplikat dalam batas stok -> 1 baris detail terkonsolidasi & 1 update stok", async () => {
    const { db, tx, writes } = createHarness();

    const result = await executeOutgoingTransaction(db, USER_ID, {
      items: [
        { itemId: 1, quantity: 4 },
        { itemId: 1, quantity: 6 },
      ],
    });

    expect(result.itemsProcessed).toBe(1);
    expect(insertsInto(writes, outgoingTransactionItem)[0].values).toEqual([
      { transactionId: 99, itemId: 1, quantity: 10, unit: "Pcs" },
    ]);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(writes.updates[0].set).toMatchObject({ quantity: 40, status: "MENIPIS" });
  });

  it("K2 stok turun oleh transaksi konkuren (50 -> 3) -> divalidasi ulang di bawah lock, 400 + ROLLBACK", async () => {
    // Pre-check melihat stok 50, tetapi saat baris dikunci di dalam transaksi stok tinggal 3.
    const { db, tx, lifecycle, writes } = createHarness({
      txCatalog: [{ id: 1, name: "Kemeja Oxford", quantity: 3, warehouseId: 1 }],
    });
    tx.execute = vi.fn().mockResolvedValue([{ next_val: 1 }]);

    await expectValidationError(
      executeOutgoingTransaction(db, USER_ID, { items: [{ itemId: 1, quantity: 5 }] }),
      'Stok untuk "Kemeja Oxford" tidak mencukupi. Tersedia: 3 Pcs, diminta: 5 Pcs.',
      400
    );
    expect(lifecycle.rollback).toHaveBeenCalledTimes(1);
    expect(lifecycle.commit).not.toHaveBeenCalled();
    expect(writes.inserts).toHaveLength(0);
    expect(writes.updates).toHaveLength(0);
    // Validasi gagal sebelum nextval() -> nomor sequence tidak terbuang
    expect(tx.execute).not.toHaveBeenCalled();
  });

  it("K2b lock query memfilter id & pemilik, diurutkan by id, lalu FOR UPDATE", async () => {
    const { db, tx } = createHarness({
      catalog: [
        { id: 1, name: "Kemeja Oxford", quantity: 50, warehouseId: 1 },
        { id: 2, name: "Celana Chino", quantity: 50, warehouseId: 1 },
      ],
    });

    await executeOutgoingTransaction(db, USER_ID, {
      items: [
        { itemId: 2, quantity: 1 },
        { itemId: 1, quantity: 1 },
      ],
    });

    const { params } = new PgDialect().sqlToQuery(tx.where.mock.calls[0][0]);
    expect(params).toEqual(expect.arrayContaining([1, 2, USER_ID]));
    expect(tx.orderBy.mock.calls[0][0]).toBe(item.id); // urutan lock konsisten -> anti deadlock
    expect(tx.for).toHaveBeenCalledWith("update");
  });
});
