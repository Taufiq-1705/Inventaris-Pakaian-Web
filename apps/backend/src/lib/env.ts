/**
 * Environment validation — fail fast at startup if required config is
 * missing or insecure, instead of failing obscurely at request time.
 * Import this module before anything that reads process.env.
 */
import "dotenv/config";

const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;
const INSECURE_SECRETS = [
  "your-secret-key-change-in-production",
  "your-secret-key-min-32-chars-change-in-production",
];

const errors: string[] = [];

for (const key of REQUIRED) {
  if (!process.env[key]?.trim()) errors.push(`${key} belum diisi`);
}

const secret = process.env.BETTER_AUTH_SECRET ?? "";
if (secret && secret.length < 32) {
  errors.push("BETTER_AUTH_SECRET minimal 32 karakter");
}
if (INSECURE_SECRETS.includes(secret)) {
  errors.push("BETTER_AUTH_SECRET masih memakai nilai contoh — generate secret acak");
}

if (errors.length > 0) {
  console.error("\n[env] Konfigurasi apps/backend/.env tidak valid:");
  for (const e of errors) console.error(`  - ${e}`);
  console.error("  Lihat apps/backend/.env.example dan docs/SECURITY.md\n");
  process.exit(1);
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: secret,
  PORT: Number(process.env.PORT) || 3001,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
};
