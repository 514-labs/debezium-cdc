/**
 * Shared Configuration class that mimics Pulumi Config API
 * Reads from environment variables instead of Pulumi config
 *
 * This class can be used across the entire codebase for consistent config access.
 */

import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load .env files (prefer .env.dev if it exists, otherwise fall back to .env)
const envDevPath = path.join(process.cwd(), ".env.dev");
const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envDevPath)) {
  loadEnv({ path: envDevPath });
} else if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath });
} else {
  // Fall back to default dotenv behavior (loads .env if it exists)
  loadEnv();
}

/**
 * Configuration class that mimics Pulumi Config API
 *
 * Usage:
 *   const config = new Config();
 *   const value = config.get("MY_KEY");                    // Optional
 *   const required = config.require("MY_KEY");            // Required
 *   const number = config.getNumber("MY_PORT") || 8080;   // Optional number
 *   const secret = config.requireSecret("MY_SECRET");     // Required secret
 *
 * With namespace prefix:
 *   const config = new Config("DEBEZIUM");
 *   config.get("KAFKA_BOOTSTRAP_SERVERS");  // Reads DEBEZIUM_KAFKA_BOOTSTRAP_SERVERS
 */
export class Config {
  private prefix: string;

  /**
   * Create a new Config instance
   * @param name Optional namespace/prefix for environment variables (e.g., "DEBEZIUM" -> "DEBEZIUM_*")
   */
  constructor(name?: string) {
    this.prefix = name ? `${name}_` : "";
  }

  /**
   * Get an environment variable key with optional prefix
   * Uses the key exactly as provided, with optional prefix
   */
  private getEnvKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get an optional string value
   * @param key Configuration key (used exactly as provided, e.g., "DB_HOST")
   * @returns The value or undefined if not set
   */
  get(key: string): string | undefined {
    const envKey = this.getEnvKey(key);
    return process.env[envKey];
  }

  /**
   * Get a required string value
   * @param key Configuration key (used exactly as provided)
   * @returns The value
   * @throws Error if the value is not set
   */
  require(key: string): string {
    const value = this.get(key);
    if (value === undefined) {
      const envKey = this.getEnvKey(key);
      throw new Error(
        `Required configuration '${key}' (env: ${envKey}) is not set. Please set it in your .env file or environment.`
      );
    }
    return value;
  }

  /**
   * Get a required secret value (same as require, but semantically indicates sensitive data)
   * @param key Configuration key (used exactly as provided)
   * @returns The value
   * @throws Error if the value is not set
   */
  requireSecret(key: string): string {
    return this.require(key);
  }

  /**
   * Get an optional number value
   * @param key Configuration key (used exactly as provided)
   * @returns The parsed number or undefined if not set
   * @throws Error if the value exists but is not a valid number
   */
  getNumber(key: string): number | undefined {
    const value = this.get(key);
    if (value === undefined) {
      return undefined;
    }
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      const envKey = this.getEnvKey(key);
      throw new Error(
        `Configuration '${key}' (env: ${envKey}) must be a valid number, got: ${value}`
      );
    }
    return parsed;
  }

  /**
   * Get an optional boolean value
   * @param key Configuration key (used exactly as provided)
   * @returns The parsed boolean or undefined if not set
   */
  getBoolean(key: string): boolean | undefined {
    const value = this.get(key);
    if (value === undefined) {
      return undefined;
    }
    const normalized = value.toLowerCase().trim();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    const envKey = this.getEnvKey(key);
    throw new Error(
      `Configuration '${key}' (env: ${envKey}) must be a valid boolean (true/false, 1/0, yes/no), got: ${value}`
    );
  }

  /**
   * Get an object value (parsed as JSON)
   * @param key Configuration key (used exactly as provided)
   * @returns The parsed object or undefined if not set
   * @throws Error if the value exists but is not valid JSON
   */
  getObject<T = any>(key: string): T | undefined {
    const value = this.get(key);
    if (value === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      const envKey = this.getEnvKey(key);
      throw new Error(
        `Configuration '${key}' (env: ${envKey}) must be valid JSON: ${error}`
      );
    }
  }
}
