import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Brute-force protection for credential endpoints.
 * In dev: 100 attempts per 15 minutes to allow smooth testing.
 * In prod: 10 attempts per 15 minutes per IP (sign-in & sign-up).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 100 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.",
    error: "Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.",
  },
});

