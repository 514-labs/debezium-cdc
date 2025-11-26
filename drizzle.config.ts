import type { Config } from "drizzle-kit";
import { getDbConfig } from "./postgres/src/db";

// Use getDbConfig() directly instead of Proxy-wrapped dbConfig
// drizzle-kit needs to read the actual config object properties
const dbConfig = getDbConfig();

export default {
  schema: "./postgres/src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: dbConfig,
} satisfies Config;
