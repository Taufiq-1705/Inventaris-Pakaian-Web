import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";
// vi.mock()/vi.hoisted() below are hoisted above this import by Vitest
import { app } from "../src/index.js";

// ============================================================================
// Integration Path Test: Express (supertest) -> requireAuth -> controller ->
// executeOutgoingTransaction -> Drizzle.
//
// Hanya BATAS INFRASTRUKTUR yang di-mock (koneksi DB & sesi better-auth),
// sehingga middleware, controller, dan service yang ASLI ikut dieksekusi.
// Tidak membutuhkan Postgres hidup -> deterministik & bisa jalan di CI.
// ============================================================================

const h = vi.hoisted(() => {
  const SESSION = {
    user: { id: "test-user-id", name: "Tester", email: "tester@mail.com" },
    session: { id: "session-123", userId: "test-user-id", expiresAt: new Date() },
  };

  const state = {
    SESSION,
    /** Antrian hasil untuk setiap pemanggilan db.select(...) berurutan. Error = query gagal. */
    selectResults: [] as unknown[],
    catalog: [] as any[],
    nextSeq: 57,
    /** Jika di-set, insert pertama di dalam transaksi melempar error ini. */
    txFailure: null as Error | null,
    lifecycle: { commit: vi.fn(), rollback: vi.fn() },
    getSession: vi.fn(),
    db: null as any,
  };

  const makeQuery = (result: unknown) => {
    const q: any = {};
    for (const m of ["from", "leftJoin", "innerJoin", "where", "orderBy", "limit", "offset", "for"]) {
      q[m] = vi.fn(() => q);
    }
    q.then = (onFulfilled: any, onRejected: any) =>
      (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(
        onFulfilled,
        onRejected
      );
    return q;
  };

  state.db = {
    select: vi.fn(() =>
      makeQuery(state.selectResults.length ? state.selectResults.shift() : [])
    ),
    query: { item: { findMany: vi.fn(async () => [...state.catalog]) } },
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        // Bentuk hasil asli postgres-js: array baris
        execute: vi.fn(async () => [{ next_val: state.nextSeq }]),
        // Lock query: select().from(item).where(...).orderBy(...).for("update")
        select: vi.fn(() => makeQuery([...state.catalog])),
        insert: vi.fn(() => ({
          values: vi.fn((values: any) => {
            if (state.txFailure) throw state.txFailure;
            return { returning: vi.fn(async () => [{ id: 10, ...values }]) };
          }),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
      };
      try {
        const result = await callback(tx);
        state.lifecycle.commit();
        return result;
      } catch (err) {
        state.lifecycle.rollback(err);
        throw err;
      }
    }),
  };

  return state;
});

vi.mock("../src/db/index.js", () => ({ db: h.db }));

vi.mock("../src/lib/auth.js", () => ({
  auth: {
    api: { getSession: h.getSession },
    handler: vi.fn(async () => new Response(null, { status: 404 })),
  },
}));

const DEFAULT_CATALOG = [{ id: 1, name: "Kaos Polos", quantity: 50, warehouseId: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.getSession.mockReset();
  h.getSession.mockResolvedValue(h.SESSION);
  h.selectResults = [];
  h.catalog = DEFAULT_CATALOG.map((i) => ({ ...i }));
  h.nextSeq = 57;
  h.txFailure = null;
});

/** Mengompilasi argumen .where() milik query ke-n menjadi SQL + params. */
function compiledWhere(selectCallIndex: number) {
  const query = h.db.select.mock.results[selectCallIndex].value;
  const whereArg = query.where.mock.calls[0][0];
  return new PgDialect().sqlToQuery(whereArg);
}

// ─────────────────────────────────────────────────────────────────────────────
describe("Infrastruktur aplikasi (app-level middleware)", () => {
  it("GET /api/health -> 200 OK", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", version: "1.0.0" });
  });

  it("Route /api tidak dikenal -> 404 JSON dari notFoundHandler", async () => {
    const res = await request(app).get("/api/tidak-ada");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Endpoint tidak ditemukan: GET /api/tidak-ada");
  });

  it("Body JSON rusak -> 400 dari errorHandler (entity.parse.failed), service tidak dipanggil", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .set("Content-Type", "application/json")
      .send('{"items": [');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Format JSON tidak valid");
    expect(h.db.transaction).not.toHaveBeenCalled();
  });

  it("Body > 1mb -> 413 dari errorHandler (entity.too.large)", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [], padding: "x".repeat(1_100_000) });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe("Ukuran data terlalu besar");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("requireAuth (middleware asli)", () => {
  it("Sesi tidak ada -> 401, controller tidak dieksekusi", async () => {
    h.getSession.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [{ itemId: 1, quantity: 5 }] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized — silakan login terlebih dahulu");
    expect(h.db.query.item.findMany).not.toHaveBeenCalled();
  });

  it("getSession melempar error -> 401 'sesi tidak valid'", async () => {
    h.getSession.mockRejectedValueOnce(new Error("invalid signature"));

    const res = await request(app).get("/api/outgoing/history");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized — sesi tidak valid");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/outgoing (controller + service asli)", () => {
  it("Payload valid -> 201 Created, transaksi COMMIT", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({ date: "2026-10-15", items: [{ itemId: 1, quantity: 10 }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction).toMatchObject({
      id: 10,
      transactionCode: "KB-00057",
      createdById: "test-user-id",
    });
    expect(h.lifecycle.commit).toHaveBeenCalledTimes(1);
    expect(h.lifecycle.rollback).not.toHaveBeenCalled();
  });

  it.each([
    ["body tanpa items", {}, "Daftar barang tidak boleh kosong"],
    ["items kosong", { items: [] }, "Daftar barang tidak boleh kosong"],
    ["quantity 0", { items: [{ itemId: 1, quantity: 0 }] }, "ID barang dan jumlah yang valid wajib diisi"],
    ["quantity negatif", { items: [{ itemId: 1, quantity: -5 }] }, "ID barang dan jumlah yang valid wajib diisi"],
    ["quantity string", { items: [{ itemId: 1, quantity: "sepuluh_pcs_invalid" }] }, "ID barang dan jumlah yang valid wajib diisi"],
    ["itemId hilang", { items: [{ quantity: 5 }] }, "ID barang dan jumlah yang valid wajib diisi"],
  ])("%s -> 400 Bad Request, transaksi tidak dibuka", async (_label, body, message) => {
    const res = await request(app).post("/api/outgoing").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect(h.db.transaction).not.toHaveBeenCalled();
  });

  it("Kuantitas melebihi stok -> 400 dengan pesan stok spesifik", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [{ itemId: 1, quantity: 51 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      'Stok untuk "Kaos Polos" tidak mencukupi. Tersedia: 50 Pcs, diminta: 51 Pcs.'
    );
    expect(h.db.transaction).not.toHaveBeenCalled();
  });

  it("Barang tidak ditemukan -> 404 Not Found", async () => {
    h.catalog = [];

    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [{ itemId: 999, quantity: 5 }] });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Barang dengan ID 999 tidak ditemukan");
  });

  it("Error DB di dalam transaksi -> 500 + ROLLBACK (pesan error mentah diteruskan ke klien)", async () => {
    h.txFailure = new Error("connection terminated unexpectedly");

    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [{ itemId: 1, quantity: 5 }] });

    expect(res.status).toBe(500);
    // Mendokumentasikan perilaku saat ini: detail internal DB bocor ke response
    expect(res.body.error).toBe("connection terminated unexpectedly");
    expect(h.lifecycle.rollback).toHaveBeenCalledTimes(1);
    expect(h.lifecycle.commit).not.toHaveBeenCalled();
  });

  it("Error tanpa message -> 500 dengan pesan fallback", async () => {
    h.txFailure = new Error("");

    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [{ itemId: 1, quantity: 5 }] });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Gagal menyimpan transaksi keluar");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/outgoing/next-code (dihapus)", () => {
  it("Endpoint tidak lagi tersedia -> 404; kode final berasal dari POST /api/outgoing", async () => {
    const res = await request(app).get("/api/outgoing/next-code");

    expect(res.status).toBe(404);
    expect(h.db.select).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/outgoing/history", () => {
  const LOGS = [
    { id: 1, type: "MASUK", quantity: 20, createdAt: "2026-10-01T00:00:00.000Z", itemId: 1,
      itemName: "Kaos", itemCode: "KS-01", remainingStock: 40, transactionCode: null },
    { id: 2, type: "MASUK", quantity: 7, createdAt: "2026-10-02T00:00:00.000Z", itemId: 1,
      itemName: "Kaos", itemCode: "KS-01", remainingStock: 40, transactionCode: "TRF-00001" },
    { id: 3, type: "KELUAR", quantity: 5, createdAt: "2026-10-03T00:00:00.000Z", itemId: 2,
      itemName: null, itemCode: null, remainingStock: null, transactionCode: "KB-00003" },
    { id: 4, type: "KELUAR", quantity: 2, createdAt: "2026-10-04T00:00:00.000Z", itemId: 1,
      itemName: "Kaos", itemCode: "KS-01", remainingStock: 40, transactionCode: null },
  ];

  it("Memetakan setiap cabang format log & pagination default", async () => {
    h.selectResults = [[{ count: 4 }], LOGS];

    const res = await request(app).get("/api/outgoing/history");

    expect(res.status).toBe(200);
    expect(res.body.history.map((r: any) => [r.transactionCode, r.quantity])).toEqual([
      ["MASUK-BARU", 20], // MASUK tanpa kode
      ["TRF-00001", 7], // MASUK dengan kode
      ["KB-00003", -5], // KELUAR -> kuantitas negatif
      ["KB-UNKNOWN", -2], // KELUAR tanpa kode
    ]);
    expect(res.body.history[2]).toMatchObject({
      itemName: "Barang Dihapus",
      itemCode: "-",
      remainingStock: 0,
      unit: "Pcs",
    });
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 4, totalPages: 1 });
  });

  it.each([
    ["page=-5&limit=1000", { page: 1, limit: 100, offset: 0 }],
    ["page=3&limit=5", { page: 3, limit: 5, offset: 10 }],
    ["page=abc&limit=xyz", { page: 1, limit: 10, offset: 0 }],
    ["limit=0", { page: 1, limit: 10, offset: 0 }],
  ])("Clamp pagination '%s'", async (qs, expected) => {
    h.selectResults = [[{ count: 0 }], []];

    const res = await request(app).get(`/api/outgoing/history?${qs}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: expected.page, limit: expected.limit });
    const dataQuery = h.db.select.mock.results[1].value;
    expect(dataQuery.limit).toHaveBeenCalledWith(expected.limit);
    expect(dataQuery.offset).toHaveBeenCalledWith(expected.offset);
  });

  it("Semua filter aktif (type, search, dateFrom, dateTo) masuk ke klausa WHERE", async () => {
    h.selectResults = [[{ count: 0 }], []];

    const res = await request(app).get(
      "/api/outgoing/history?type=KELUAR&search=kaos&dateFrom=2026-01-01&dateTo=2026-12-31"
    );

    expect(res.status).toBe(200);
    const { sql, params } = compiledWhere(0);
    expect(params).toContain("KELUAR");
    expect(params.filter((p) => p === "%kaos%")).toHaveLength(3); // name, code, transactionCode
    expect(sql).toMatch(/>=/);
    expect(sql).toMatch(/<=/);
    expect(sql.toLowerCase()).toContain("ilike");
  });

  it("type=Semua tidak menambah filter tipe", async () => {
    h.selectResults = [[{ count: 0 }], []];

    await request(app).get("/api/outgoing/history?type=Semua");

    const { params } = compiledWhere(0);
    expect(params).not.toContain("Semua");
  });

  it("Query gagal -> 500", async () => {
    h.selectResults = [new Error("timeout")];

    const res = await request(app).get("/api/outgoing/history");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Gagal memuat riwayat keluar masuk barang");
  });
});
