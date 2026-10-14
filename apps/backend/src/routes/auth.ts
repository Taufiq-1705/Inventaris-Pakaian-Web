import { Router } from "express";
import { auth } from "../lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import { db } from "../db/index.js";
import { user } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

const router = Router();

// Middleware to prevent duplicate Name, Email, Username, or Phone on registration
router.post("/sign-up/email", async (req, res, next) => {
  try {
    const { name, email, phone, username } = req.body;

    if (!name || !email) {
      return next(); // Delegate to Better Auth for standard missing input error
    }

    // 1. Check duplicate email (case-insensitive)
    const existingEmail = await db.query.user.findFirst({
      where: eq(sql`lower(${user.email})`, email.toLowerCase()),
    });
    if (existingEmail) {
      res.status(400).json({
        message: "Email sudah digunakan oleh akun lain",
        error: "Email sudah digunakan oleh akun lain",
      });
      return;
    }

    // 2. Check duplicate username (case-insensitive, if provided)
    if (username) {
      const existingUsername = await db.query.user.findFirst({
        where: eq(sql`lower(${user.username})`, username.toLowerCase()),
      });
      if (existingUsername) {
        res.status(400).json({
          message: "Username sudah digunakan oleh akun lain. Silakan gunakan username lain.",
          error: "Username sudah digunakan oleh akun lain. Silakan gunakan username lain.",
        });
        return;
      }
    }

    // 3. Check duplicate name (case-insensitive)
    const existingName = await db.query.user.findFirst({
      where: eq(sql`lower(${user.name})`, name.toLowerCase()),
    });
    if (existingName) {
      res.status(400).json({
        message: "Nama sudah terdaftar. Silakan gunakan nama lain.",
        error: "Nama sudah terdaftar. Silakan gunakan nama lain.",
      });
      return;
    }

    // 4. Check duplicate phone (if provided)
    if (phone) {
      const existingPhone = await db.query.user.findFirst({
        where: eq(user.phone, phone),
      });
      if (existingPhone) {
        res.status(400).json({
          message: "Nomor HP sudah terdaftar. Silakan gunakan nomor lain.",
          error: "Nomor HP sudah terdaftar. Silakan gunakan nomor lain.",
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error("Signup validation error:", error);
    res.status(500).json({
      message: "Gagal memproses pendaftaran",
      error: "Gagal memproses pendaftaran",
    });
  }
});

// Mount Better Auth handler — handles all /api/auth/* routes automatically:
router.all("/*splat", toNodeHandler(auth));

export default router;
