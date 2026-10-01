import { Router } from "express";
import { db } from "../db/index.js";
import { user, item, activityLog, transfer, session, account } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/profile
 * Get current user profile data
 */
router.get("/", async (req, res) => {
  try {
    const result = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id),
      columns: {
        id: true,
        name: true,
        email: true,
        username: true,
        phone: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!result) {
      res.status(404).json({ error: "Profil tidak ditemukan" });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Gagal memuat profil" });
  }
});

/**
 * PUT /api/profile
 * Update profile info (name, username, email, phone)
 */
router.put("/", async (req, res) => {
  try {
    const { name, username, email, phone } = req.body;

    const [updated] = await db
      .update(user)
      .set({
        name: name ?? undefined,
        username: username ?? undefined,
        email: email ?? undefined,
        phone: phone ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(user.id, req.user!.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        image: user.image,
        updatedAt: user.updatedAt,
      });

    res.json(updated);
  } catch (error: any) {
    console.error("Update profile error:", error);
    if (error?.code === "23505") {
      res.status(409).json({ error: "Username atau email sudah digunakan" });
      return;
    }
    res.status(500).json({ error: "Gagal memperbarui profil" });
  }
});

/**
 * GET /api/profile/stats
 * Get user activity statistics (for ProfilPage sidebar)
 */
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user!.id;

    // Count items created (Barang Masuk)
    const masukResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .where(eq(activityLog.createdById, userId));
    const totalActivities = masukResult[0]?.count ?? 0;

    // Count transfers completed (Mutasi Selesai)
    const transferResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transfer)
      .where(eq(transfer.createdById, userId));
    const totalTransfers = transferResult[0]?.count ?? 0;

    res.json({
      totalActivities,
      totalTransfers,
      totalReports: 0, // Placeholder — reports feature not yet implemented
    });
  } catch (error) {
    console.error("Profile stats error:", error);
    res.status(500).json({ error: "Gagal memuat statistik" });
  }
});

/**
 * DELETE /api/profile
 * Delete the current user's account and ALL associated data.
 * Cascade order: activity_log → transfer → item → session → account → user
 */
router.delete("/", async (req, res) => {
  try {
    const userId = req.user!.id;

    // 1. Delete all activity logs created by this user
    await db.delete(activityLog).where(eq(activityLog.createdById, userId));

    // 2. Delete all transfers created by this user
    await db.delete(transfer).where(eq(transfer.createdById, userId));

    // 3. Delete all items created by this user
    await db.delete(item).where(eq(item.createdById, userId));

    // 4. Delete Better Auth sessions
    await db.delete(session).where(eq(session.userId, userId));

    // 5. Delete Better Auth accounts (OAuth providers)
    await db.delete(account).where(eq(account.userId, userId));

    // 6. Delete the user record itself
    await db.delete(user).where(eq(user.id, userId));

    res.json({ message: "Akun dan semua data berhasil dihapus" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Gagal menghapus akun" });
  }
});

export default router;

