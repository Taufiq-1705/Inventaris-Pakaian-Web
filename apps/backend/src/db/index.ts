import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;

// For query purposes (used by the app)
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

// For migrations (used by drizzle-kit, not needed at runtime)
export const migrationClient = postgres(connectionString, { max: 1 });
