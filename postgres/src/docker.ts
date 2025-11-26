/**
 * Docker container operations for PostgreSQL
 * Handles container detection and health checks
 */

import { execSync } from "child_process";
import { Config } from "../../config/config";

/** Sleep utility */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Detect running PostgreSQL Docker container
 */
export async function getPostgresContainer(): Promise<{
  hasLocalDb: boolean;
  postgresContainerName: string | null;
}> {
  try {
    const result = execSync("docker ps --format '{{.Names}}'", {
      encoding: "utf8",
    });
    const containers = result.split("\n").filter(Boolean);
    const postgresContainer = containers.find((name) =>
      name.toLowerCase().includes("postgres")
    );
    return {
      hasLocalDb: !!postgresContainer,
      postgresContainerName: postgresContainer || null,
    };
  } catch {
    return { hasLocalDb: false, postgresContainerName: null };
  }
}

/**
 * Wait for PostgreSQL container to be ready
 */
export async function waitForPostgres(
  config: Config,
  containerName: string,
  maxAttempts = 30
): Promise<void> {
  console.log("⏳ Waiting for PostgreSQL to be ready...");

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      execSync(
        `docker exec ${containerName} pg_isready -U ${config.require(
          "DB_USER"
        )} -d ${config.require("DB_NAME")}`,
        { stdio: "pipe" }
      );
      console.log("✅ PostgreSQL ready!");
      return;
    } catch {
      // Not ready yet
    }
    console.log(`   Waiting... (${i}/${maxAttempts})`);
    await sleep(2000);
  }

  throw new Error("PostgreSQL not ready after 60s");
}

/**
 * Push database schema using drizzle-kit
 */
export function pushSchema(): void {
  console.log("\n📊 Pushing database schema...");
  try {
    execSync("pnpm db:push", { stdio: "inherit" });
  } catch {
    execSync("npm run db:push", { stdio: "inherit" });
  }
}
