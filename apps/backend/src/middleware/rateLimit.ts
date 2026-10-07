import rateLimit from "express-rate-limit";

/**
 * Brute-force protection for credential endpoints.
 * 10 attempts per 15 minutes per IP (sign-in & sign-up).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit." },
});
