/**
 * Database connection and configuration
 * Provides both lazy-loaded exports and direct getters for compatibility
 */

import { Config } from "../../config/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get database configuration from environment variables
 * Required: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
export function getDbConfig() {
  const config = new Config();
  return {
    host: config.require("DB_HOST"),
    port: config.getNumber("DB_PORT")!,
    database: config.require("DB_NAME"),
    user: config.require("DB_USER"),
    password: config.require("DB_PASSWORD"),
    ssl: false,
  } as const;
}

// Lazy-loaded config via Proxy (avoids validation at import time)
let _dbConfig: ReturnType<typeof getDbConfig> | null = null;

export const dbConfig = new Proxy({} as ReturnType<typeof getDbConfig>, {
  get(_target, prop) {
    if (!_dbConfig) _dbConfig = getDbConfig();
    return _dbConfig[prop as keyof typeof _dbConfig];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Connection Pool
// ─────────────────────────────────────────────────────────────────────────────

let _pool: Pool | null = null;

/** Get the connection pool (creates on first call) */
export function getPool(): Pool {
  if (!_pool) _pool = new Pool(getDbConfig());
  return _pool;
}

/** Close the connection pool */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// Lazy-loaded pool via Proxy
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return getPool()[prop as keyof Pool];
  },
}) as Pool;

// ─────────────────────────────────────────────────────────────────────────────
// Drizzle Instance
// ─────────────────────────────────────────────────────────────────────────────

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Get drizzle instance (creates on first call) */
export function getDb() {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

// Lazy-loaded drizzle instance via Proxy
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) _db = drizzle(getPool(), { schema });
    return _db[prop as keyof typeof _db];
  },
}) as ReturnType<typeof drizzle<typeof schema>>;

// Re-export schema for convenience
export { schema };
