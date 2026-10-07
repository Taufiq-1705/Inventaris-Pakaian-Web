import type { Request, Response, NextFunction } from "express";

/** 404 for unknown /api routes — returns JSON instead of Express's HTML page. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` });
}

/**
 * Global error handler — last middleware in the chain.
 * Always responds with JSON and never leaks stack traces to the client.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Malformed JSON body / payload too large from express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Format JSON tidak valid" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Ukuran data terlalu besar" });
    return;
  }

  console.error("[error]", err);
  const status = Number(err?.status || err?.statusCode) || 500;
  res.status(status).json({
    error: status < 500 && err?.message ? err.message : "Terjadi kesalahan pada server",
  });
}
