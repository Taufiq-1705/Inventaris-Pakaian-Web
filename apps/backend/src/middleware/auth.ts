import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        username?: string | null;
        phone?: string | null;
        image?: string | null;
      };
      session?: {
        id: string;
        userId: string;
        expiresAt: Date;
      };
    }
  }
}

/**
 * Middleware that checks for a valid Better Auth session.
 * If valid, attaches `req.user` and `req.session`.
 * If not valid, returns 401.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!result) {
      res.status(401).json({ error: "Unauthorized — silakan login terlebih dahulu" });
      return;
    }

    req.user = result.user as Express.Request["user"];
    req.session = result.session as Express.Request["session"];
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized — sesi tidak valid" });
  }
}
