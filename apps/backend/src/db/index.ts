import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;

// Pool koneksi aplikasi. Koneksi idle ditutup setelah 20 detik agar tidak
// menahan slot Postgres saat trafik sepi; ukuran pool bisa diatur via env.
const queryClient = postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX) || 10,
  idle_timeout: 20,
});
export const db = drizzle(queryClient, { schema });
