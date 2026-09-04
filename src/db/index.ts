import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

declare global {
  var __portfolioDbPool: Pool | undefined;
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("DATABASE_URL is required to connect to the database.");
  const pool =
    globalThis.__portfolioDbPool ?? new Pool({ connectionString: url });
  globalThis.__portfolioDbPool = pool;
  return drizzle(pool, { schema });
}

export const db = createDb();
export type Database = typeof db;
