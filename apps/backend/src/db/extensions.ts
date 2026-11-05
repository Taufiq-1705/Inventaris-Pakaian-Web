/**
 * Membuat ekstensi Postgres yang dibutuhkan schema SEBELUM drizzle-kit push/migrate.
 * drizzle-kit tidak mengelola ekstensi, sedangkan indeks GIN trigram di
 * schema.ts (item_name_trgm_idx, item_code_trgm_idx) butuh operator class
 * gin_trgm_ops dari pg_trgm. Idempoten: aman dijalankan berulang.
 */
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

try {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  console.log("[db] extension pg_trgm siap");
} finally {
  await sql.end();
}
