import { env } from "./lib/env.js"; // must be first: validates .env before anything else
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRateLimiter } from "./middleware/rateLimit.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

// Route imports
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import itemRoutes from "./routes/items.js";
import warehouseRoutes from "./routes/warehouses.js";
import transferRoutes from "./routes/transfers.js";
import profileRoutes from "./routes/profile.js";
import categoryRoutes from "./routes/categories.js";
import outgoingRoutes from "./routes/outgoing.js";

const app = express();
const PORT = env.PORT;

// --- Middleware ---------------------------------------------------------
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // Required for Better Auth cookies
  })
);
app.use(express.json({ limit: "1mb" }));

// --- Routes -------------------------------------------------------------

// Brute-force protection on credential endpoints
app.use(["/api/auth/sign-in", "/api/auth/sign-up"], authRateLimiter);

// Better Auth - handles /api/auth/* (login, register, session, etc.)
app.use("/api/auth", authRoutes);

// Application routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/outgoing", outgoingRoutes);

// --- Health Check -------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// --- Error Handling (must be registered last) --------------------------
app.use("/api", notFoundHandler);
app.use(errorHandler);

// --- Start Server -------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\nBackend server running at http://localhost:${PORT}`);
  console.log(`API routes:`);
  console.log(`   Auth:       http://localhost:${PORT}/api/auth/*`);
  console.log(`   Dashboard:  http://localhost:${PORT}/api/dashboard/*`);
  console.log(`   Items:      http://localhost:${PORT}/api/items`);
  console.log(`   Warehouses: http://localhost:${PORT}/api/warehouses`);
  console.log(`   Transfers:  http://localhost:${PORT}/api/transfers`);
  console.log(`   Outgoing:   http://localhost:${PORT}/api/outgoing`);
  console.log(`   Profile:    http://localhost:${PORT}/api/profile`);
  console.log(`   Categories: http://localhost:${PORT}/api/categories`);
  console.log(`   Health:     http://localhost:${PORT}/api/health`);
  console.log(`\n`);
});
