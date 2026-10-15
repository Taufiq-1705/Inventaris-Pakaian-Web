import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../src/index.js";

// Mock middleware authentication
vi.mock("../src/middleware/auth.js", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers["x-test-unauthorized"] === "true") {
      res.status(401).json({ error: "Unauthorized — silakan login terlebih dahulu" });
      return;
    }
    req.user = { id: "test-user-id", name: "Tester", email: "tester@mail.com" };
    req.session = { id: "session-123" };
    next();
  },
}));

// Mock transactionService
vi.mock("../src/lib/transactionService.js", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    executeOutgoingTransaction: vi.fn().mockImplementation(async (_db, _userId, payload) => {
      if (!payload.items || payload.items.length === 0) {
        throw new actual.TransactionValidationError("Daftar barang tidak boleh kosong", 400);
      }
      if (payload.items.some((i: any) => i.quantity <= 0)) {
        throw new actual.TransactionValidationError("ID barang dan jumlah yang valid wajib diisi", 400);
      }
      if (payload.items.some((i: any) => i.itemId === 999)) {
        throw new actual.TransactionValidationError("Barang dengan ID 999 tidak ditemukan", 404);
      }
      if (payload.items.some((i: any) => i.quantity > 100)) {
        throw new actual.TransactionValidationError('Stok untuk "Kaos" tidak mencukupi', 400);
      }
      if (payload.simulateInternalError) {
        throw new Error("Internal database fatal error");
      }
      return {
        transactionCode: "KB-00001",
        transactionId: 10,
        itemsProcessed: payload.items.length,
        transaction: {
          id: 10,
          transactionCode: "KB-00001",
          items: payload.items,
        },
      };
    }),
  };
});

describe("Integration Test: Express API Endpoints (Supertest)", () => {
  it("GET /api/health: Returns 200 OK with server status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("1.0.0");
  });

  it("POST /api/outgoing: Returns 401 Unauthorized when session is missing", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .set("x-test-unauthorized", "true")
      .send({ items: [{ itemId: 1, quantity: 5 }] });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Unauthorized");
  });

  it("POST /api/outgoing: Returns 201 Created on valid transaction payload", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({
        items: [{ itemId: 1, quantity: 10 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction.transactionCode).toBe("KB-00001");
  });

  it("POST /api/outgoing: Returns 400 Bad Request on empty items list", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Daftar barang tidak boleh kosong");
  });

  it("POST /api/outgoing: Returns 400 Bad Request on invalid quantity <= 0", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [{ itemId: 1, quantity: 0 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ID barang dan jumlah yang valid wajib diisi");
  });

  it("POST /api/outgoing: Returns 404 Not Found when item does not exist", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({ items: [{ itemId: 999, quantity: 5 }] });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("tidak ditemukan");
  });

  it("POST /api/outgoing: Returns 500 Internal Server Error when transaction crashes", async () => {
    const res = await request(app)
      .post("/api/outgoing")
      .send({
        items: [{ itemId: 1, quantity: 5 }],
        simulateInternalError: true,
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal database fatal error");
  });

  it("GET /api/outgoing/next-code: Generates next sequential transaction code", async () => {
    const res = await request(app).get("/api/outgoing/next-code");
    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^KB-\d{5}$/);
  });

  it("GET /api/outgoing/history: Retrieves activity history with pagination", async () => {
    const res = await request(app).get("/api/outgoing/history?page=1&limit=5");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("history");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  it("GET /api/outgoing/history: Applies filters correctly (type, search, date)", async () => {
    const res = await request(app).get(
      "/api/outgoing/history?type=KELUAR&search=shirt&dateFrom=2026-01-01&dateTo=2026-12-31"
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  it("GET /api/dashboard/stats: Returns aggregated KPI and warehouse stats via single-trip query", async () => {
    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalItems");
    expect(res.body).toHaveProperty("totalStock");
    expect(res.body).toHaveProperty("warehouses");
    expect(Array.isArray(res.body.warehouses)).toBe(true);
    if (res.body.warehouses.length > 0) {
      const firstW = res.body.warehouses[0];
      expect(firstW).toHaveProperty("id");
      expect(firstW).toHaveProperty("name");
      expect(firstW).toHaveProperty("currentStock");
      expect(firstW).toHaveProperty("percentage");
    }
  });
});

