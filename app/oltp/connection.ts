// PostgreSQL database connection using Drizzle ORM
// This is the source database that Debezium monitors for changes

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create PostgreSQL connection pool
export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5433"),
  database: process.env.DB_NAME || "test-db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: false, // Disable SSL for local development
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });
