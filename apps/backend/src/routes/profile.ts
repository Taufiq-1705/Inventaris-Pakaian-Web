import { Router } from "express";
import { db } from "../db/index.js";
import { user, item, activityLog, transfer, session, account, outgoingTransaction } from "../db/schema.js";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

function parseUserAgent(ua?: string | null) {
  if (!ua) {
    return {
      deviceName: "Perangkat Tak Dikenal",
      os: "Unknown OS",
      browser: "Unknown Browser",
      icon: "devices",
    };
  }

  let os = "Desktop";
  let icon = "desktop_windows";
  if (/windows/i.test(ua)) {
    os = "Windows";
    icon = "desktop_windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "macOS";
    icon = "laptop_mac";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
    icon = "smartphone";
  } else if (/android/i.test(ua)) {
    os = "Android";
    icon = "smartphone";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
    icon = "laptop_chromebook";
  }

  let browser = "Web Browser";
  if (/edg/i.test(ua)) {
    browser = "Edge";
  } else if (/chrome|crios/i.test(ua)) {
    browser = "Chrome";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/safari/i.test(ua)) {
    browser = "Safari";
  }

  const deviceName = os === "macOS" ? "MacBook / Apple Mac" : `${os} PC`;

  return { deviceName, os, browser, icon };
}

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

    // Kedua hitungan independen -> paralel
    const [masukResult, transferResult] = await Promise.all([
      // Count items created (Barang Masuk)
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLog)
        .where(eq(activityLog.createdById, userId)),
      // Count transfers completed (Mutasi Selesai)
      db
        .select({ count: sql<number>`count(*)` })
        .from(transfer)
        .where(eq(transfer.createdById, userId)),
    ]);
    const totalActivities = masukResult[0]?.count ?? 0;
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
 * GET /api/profile/sessions
 * List active sessions for the current user (for PengaturanPage)
 */
router.get("/sessions", async (req, res) => {
  try {
    const userId = req.user!.id;
    const currentSessionId = req.session?.id;

    const activeSessions = await db
      .select({
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })
      .from(session)
      .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
      .orderBy(desc(session.createdAt));

    const formatted = activeSessions.map((s) => {
      const parsed = parseUserAgent(s.userAgent);
      return {
        id: s.id,
        ipAddress: s.ipAddress || "127.0.0.1",
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.id === currentSessionId,
        ...parsed,
      };
    });

    res.json({ sessions: formatted });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ error: "Gagal memuat sesi perangkat" });
  }
});

/**
 * DELETE /api/profile/sessions/:id
 * Revoke a specific active session
 */
router.delete("/sessions/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessionId = req.params.id;

    const [deleted] = await db
      .delete(session)
      .where(and(eq(session.id, sessionId), eq(session.userId, userId)))
      .returning({ id: session.id });

    if (!deleted) {
      res.status(404).json({ error: "Sesi tidak ditemukan" });
      return;
    }

    res.json({ message: "Sesi berhasil dicabut" });
  } catch (error) {
    console.error("Revoke session error:", error);
    res.status(500).json({ error: "Gagal mencabut sesi" });
  }
});

/**
 * DELETE /api/profile
 * Delete the current user's account and ALL associated data.
 * Cascade order: activity_log → outgoing_transaction → transfer → item → session → account → user
 */
router.delete("/", async (req, res) => {
  try {
    const userId = req.user!.id;

    await db.transaction(async (tx) => {
      // 1. Delete all activity logs created by this user
      await tx.delete(activityLog).where(eq(activityLog.createdById, userId));

      // 2. Delete all outgoing transactions created by this user (items cascade automatically)
      await tx.delete(outgoingTransaction).where(eq(outgoingTransaction.createdById, userId));

      // 3. Delete all transfers created by this user
      await tx.delete(transfer).where(eq(transfer.createdById, userId));

      // 4. Delete all items created by this user
      await tx.delete(item).where(eq(item.createdById, userId));

      // 5. Delete Better Auth sessions
      await tx.delete(session).where(eq(session.userId, userId));

      // 6. Delete Better Auth accounts (OAuth providers)
      await tx.delete(account).where(eq(account.userId, userId));

      // 7. Delete the user record itself
      await tx.delete(user).where(eq(user.id, userId));
    });

    res.json({ message: "Akun dan semua data berhasil dihapus" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Gagal menghapus akun" });
  }
});

export default router;
