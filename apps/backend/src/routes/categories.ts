import { Router } from "express";
import { db } from "../db/index.js";
import { category } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/categories
 * List all categories with their item types (for cascading dropdowns)
 */
router.get("/", async (_req, res) => {
  try {
    const categories = await db.query.category.findMany({
      with: {
        itemTypes: true,
      },
    });

    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        types: c.itemTypes.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
        })),
      })),
    });
  } catch (error) {
    console.error("List categories error:", error);
    res.status(500).json({ error: "Gagal memuat data kategori" });
  }
});

export default router;
