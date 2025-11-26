#!/usr/bin/env npx ts-node
/**
 * Debezium CDC Setup Script
 *
 * Main orchestration script that:
 * 1. Validates database setup
 * 2. Prompts user to setup database if needed
 * 3. Runs Debezium connector setup
 *
 * Usage:
 *   npx ts-node setup-cdc.ts              # Setup connector
 *   npx ts-node setup-cdc.ts --dry-run    # Show generated config
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { Config } from "./config/config";
import { generateConnectorConfig } from "./debezium/src/resources/debezium-connector";
import {
  waitForKafkaConnect,
  deleteConnectorIfExists,
  createConnector,
} from "./debezium/src/resources/kafka-connect";
import { isMooseRunning } from "./debezium/src/utils";
import {
  getPostgresContainer,
  waitForPostgres,
  pushSchema,
} from "./postgres/src/docker";
import { seedDatabase } from "./postgres/src/index";

// ─────────────────────────────────────────────────────────────────────────────
// CLI Logging Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEPARATOR =
  "════════════════════════════════════════════════════════════════";

const log = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warn: (msg: string) => console.log(`⚠️  ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`),
  tip: (msg: string) => console.log(`💡 ${msg}`),
  step: (n: number, msg: string) => console.log(`   ${n}. ${msg}`),
  cmd: (cmd: string) => console.log(`      ${cmd}`),
  bullet: (msg: string) => console.log(`   • ${msg}`),
  indent: (msg: string) => console.log(`   ${msg}`),
  raw: (msg: string) => console.log(msg),
  newline: () => console.log(),
  header: (title: string) => {
    console.log(`\n${title}`);
    console.log(SEPARATOR);
  },
  banner: (lines: string[]) => {
    console.log();
    console.log(SEPARATOR);
    lines.forEach((line) => console.log(line));
    console.log(SEPARATOR);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DatabaseValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Parse yes/no answer from user input
 * @returns true for yes, false for no, null for invalid input
 */
function parseYesNo(input: string): boolean | null {
  const normalized = input.toLowerCase().trim();
  if (normalized === "y" || normalized === "yes") return true;
  if (normalized === "n" || normalized === "no") return false;
  return null;
}

/**
 * Prompt user for yes/no input with optional default value
 * @param question - The question to ask the user
 * @param defaultValue - Optional default value if user presses Enter without input
 * @returns Promise resolving to true for yes, false for no
 */
function promptUser(
  question: string,
  defaultValue?: boolean
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Build prompt message with default indicator
  const defaultHint =
    defaultValue === true
      ? " (Y/n)"
      : defaultValue === false
      ? " (y/N)"
      : " (y/n)";
  const prompt = `${question}${defaultHint}: `;

  const errorMessage = "   Please enter 'y' for yes or 'n' for no.";

  return new Promise<boolean>((resolve) => {
    const askQuestion = (): void => {
      rl.question(prompt, (answer: string) => {
        const normalized = answer.trim();

        // Handle empty input
        if (normalized === "") {
          if (defaultValue !== undefined) {
            rl.close();
            resolve(defaultValue);
            return;
          }
          console.log(errorMessage);
          askQuestion();
          return;
        }

        // Parse and validate answer
        const result = parseYesNo(normalized);
        if (result !== null) {
          rl.close();
          resolve(result);
        } else {
          console.log(errorMessage);
          askQuestion();
        }
      });
    };

    askQuestion();
  });
}

/**
 * Validate database setup:
 * 1. Check connectivity to PostgreSQL server
 * 2. Check target database exists
 * 3. Check required tables exist in target database
 */
async function validateDatabaseSetup(
  config: Config
): Promise<DatabaseValidationResult> {
  const errors: string[] = [];

  // First, connect to default 'postgres' database to check if target database exists
  const adminPool = new Pool({
    host: config.require("DB_HOST"),
    port: config.getNumber("DB_PORT")!,
    database: "postgres", // Connect to default database
    user: config.require("DB_USER"),
    password: config.require("DB_PASSWORD"),
    connectionTimeoutMillis: 5000,
  });

  try {
    const adminClient = await adminPool.connect();

    try {
      // Check if target database exists
      const dbCheckResult = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [config.require("DB_NAME")]
      );

      if (dbCheckResult.rows.length === 0) {
        errors.push(`Database '${config.require("DB_NAME")}' does not exist`);
        adminClient.release();
        await adminPool.end();
        return { isValid: false, errors };
      }

      adminClient.release();
    } catch (error: any) {
      adminClient.release();
      errors.push(`Failed to check database existence: ${error.message}`);
      await adminPool.end();
      return { isValid: false, errors };
    }

    await adminPool.end();
  } catch (error: any) {
    await adminPool.end();
    if (error.code === "ECONNREFUSED") {
      errors.push(
        `Cannot connect to PostgreSQL server at ${config.require(
          "DB_HOST"
        )}:${config.getNumber("DB_PORT")}`
      );
    } else if (error.code === "28P01") {
      errors.push(
        `Authentication failed for user '${config.require("DB_USER")}'`
      );
    } else {
      errors.push(`Connection error: ${error.message}`);
    }
    return { isValid: false, errors };
  }

  // Now connect to target database to check tables
  const targetPool = new Pool({
    host: config.require("DB_HOST"),
    port: config.getNumber("DB_PORT")!,
    database: config.require("DB_NAME"),
    user: config.require("DB_USER"),
    password: config.require("DB_PASSWORD"),
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await targetPool.connect();

    try {
      // Check required tables exist
      const tableIncludeList = config.require("CDC_TABLE_INCLUDE_LIST");
      const tablesToCheck: Array<{ schema: string; table: string }> = [];

      // Parse table list - handle wildcard patterns like "public.*"
      const tableSpecs = tableIncludeList.split(",");
      for (const spec of tableSpecs) {
        const trimmed = spec.trim();
        const parts = trimmed.split(".");

        // Skip wildcard patterns - no need to validate "all tables"
        if (parts.length === 2 && parts[1] === "*") {
          continue;
        }

        // Parse specific table (e.g., "public.customer_addresses" or "schema.table")
        if (parts.length === 2) {
          tablesToCheck.push({
            schema: parts[0],
            table: parts[1],
          });
        }
      }

      // Remove duplicates
      const uniqueTables = Array.from(
        new Set(tablesToCheck.map((t) => `${t.schema}.${t.table}`))
      ).map((fullName) => {
        const [schema, table] = fullName.split(".");
        return { schema, table };
      });

      // Verify tables exist
      for (const { schema, table } of uniqueTables) {
        const result = await client.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = $2
          )`,
          [schema, table]
        );

        if (!result.rows[0].exists) {
          errors.push(
            `Table '${schema}.${table}' does not exist in database '${config.require(
              "DB_NAME"
            )}'`
          );
        }
      }

      client.release();
    } catch (error: any) {
      client.release();
      errors.push(`Failed to check tables: ${error.message}`);
    }

    await targetPool.end();
  } catch (error: any) {
    await targetPool.end();
    if (error.code === "3D000") {
      errors.push(`Database '${config.require("DB_NAME")}' does not exist`);
    } else {
      errors.push(
        `Failed to connect to database '${config.require("DB_NAME")}': ${
          error.message
        }`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Run PostgreSQL setup
 */
async function runPostgresSetup(): Promise<void> {
  log.header("📊 Running PostgreSQL setup...");

  const { hasLocalDb, postgresContainerName } = await getPostgresContainer();

  if (!hasLocalDb || !postgresContainerName) {
    log.error("No local postgres container detected");
    log.newline();
    log.tip("Please ensure PostgreSQL is running:");
    log.indent(
      "moose dev              # Start Moose dev server (includes postgres)"
    );
    log.indent("docker compose up -d   # Or start containers manually");
    throw new Error("PostgreSQL container not found");
  }

  log.raw(`🔍 Detected local postgres container (${postgresContainerName})`);

  const config = new Config();
  await waitForPostgres(config, postgresContainerName);
  pushSchema();
  await seedDatabase("all", 1000, 1);

  log.newline();
  log.success("PostgreSQL setup complete!");
}

/**
 * Run Debezium connector setup
 */
async function runDebeziumSetup(): Promise<void> {
  log.header("🔌 Running Debezium connector setup...");

  const config = new Config();
  const connectorConfig = generateConnectorConfig(config);
  const kafkaConnectPort = config.getNumber("KAFKA_CONNECT_PORT")!;
  const kafkaConnectUrl = `http://localhost:${kafkaConnectPort}`;

  // Check if Moose is running
  log.raw("🔍 Checking if Moose dev server is running...");
  if (!isMooseRunning()) {
    log.error("Moose dev server not detected on port 19092");
    log.newline();
    log.tip("Please start Moose dev server first:");
    log.indent("moose dev");
    throw new Error("Moose dev server not running");
  }
  log.success("Moose dev server is running!");

  // Wait for Kafka Connect
  log.raw("\n⏳ Waiting for Kafka Connect to be ready...");
  await waitForKafkaConnect(kafkaConnectUrl);

  // Save generated config for reference
  log.raw("\n📋 Generating connector configuration...");
  const configPath = path.join(process.cwd(), "postgres-connector.json");
  fs.writeFileSync(configPath, JSON.stringify(connectorConfig, null, 2));
  log.indent("✅ Saved to postgres-connector.json");

  // Delete existing connector if present
  log.raw("\n♻️  Checking for existing connector...");
  await deleteConnectorIfExists(
    kafkaConnectUrl,
    config.require("CDC_CONNECTOR_NAME")
  );

  // Create connector
  log.raw("\n🔌 Creating Debezium connector...");
  await createConnector(kafkaConnectUrl, connectorConfig);

  const connectorName = config.require("CDC_CONNECTOR_NAME");
  const topicPrefix = config.require("CDC_TOPIC_PREFIX");
  const tableIncludeList = config.require("CDC_TABLE_INCLUDE_LIST");

  log.banner(["🎉 CDC Setup Complete!"]);
  log.raw(`
Your CDC pipeline is streaming changes from:
  ${tableIncludeList} → ${topicPrefix}.*

📋 Quick Commands:

  # Check connector status
  curl ${kafkaConnectUrl}/connectors/${connectorName}/status | jq .

  # View CDC events
  docker exec debezium-cdc-redpanda-1 rpk topic consume ${topicPrefix}.public.customer_addresses --num 5

  # Manage connector
  curl -X PUT ${kafkaConnectUrl}/connectors/${connectorName}/pause   # Pause
  curl -X PUT ${kafkaConnectUrl}/connectors/${connectorName}/resume  # Resume
  curl -X DELETE ${kafkaConnectUrl}/connectors/${connectorName}      # Delete

  # Database management
  pnpm db:studio    # Open database GUI
  pnpm db:seed all 100  # Seed more data
`);
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // Load configuration
  const config = new Config();

  // Generate connector configuration (uses config values only)
  const connectorConfig = generateConnectorConfig(config);

  // Display configuration summary
  log.banner(["🚀 Setting up Debezium CDC"]);
  log.raw(
    `  Database:    ${config.require("DB_NAME")}@${config.require(
      "DB_HOST"
    )}:${config.getNumber("DB_PORT")}`
  );
  log.raw(`  Tables:      ${config.require("CDC_TABLE_INCLUDE_LIST")}`);
  log.raw(`  Topics:      ${config.require("CDC_TOPIC_PREFIX")}.*`);
  log.raw(`  Connector:   ${config.require("CDC_CONNECTOR_NAME")}`);
  log.raw(SEPARATOR);

  // Dry run - just show config
  if (dryRun) {
    log.raw("\n📋 Generated connector configuration:\n");
    log.raw(JSON.stringify(connectorConfig, null, 2));
    return;
  }

  // ============================================================
  // STEP 1: Validate Database Setup
  // ============================================================
  log.header("📊 Step 1: Validating database setup...");

  const dbValidation = await validateDatabaseSetup(config);

  if (!dbValidation.isValid) {
    log.newline();
    log.error("Database validation failed:");
    dbValidation.errors.forEach((error) => {
      log.bullet(error);
    });

    log.newline();
    log.tip("Database setup is required before creating the CDC connector.");
    log.newline();
    log.indent("Options:");
    log.step(
      1,
      "Run PostgreSQL setup automatically (recommended for local development)"
    );
    log.step(2, "Skip and fix database manually");

    const shouldSetup = await promptUser(
      "\n   Would you like to run PostgreSQL setup now?",
      true // Default to yes for automatic setup
    );

    if (shouldSetup) {
      try {
        await runPostgresSetup();
        // Re-validate after setup
        const revalidation = await validateDatabaseSetup(config);
        if (!revalidation.isValid) {
          log.newline();
          log.warn("Database setup completed but validation still failed:");
          revalidation.errors.forEach((error) => {
            log.bullet(error);
          });
          log.newline();
          log.tip("Please fix the database issues and run this script again.");
          process.exit(1);
        }
        log.newline();
        log.success("Database validation passed after setup!");
      } catch (error: any) {
        log.newline();
        log.error(`PostgreSQL setup failed: ${error.message}`);
        log.newline();
        log.tip("Please fix the database issues and run this script again.");
        process.exit(1);
      }
    } else {
      log.newline();
      log.warn("Skipping database setup.");
      log.newline();
      log.tip("To fix database issues manually:");
      log.newline();
      log.indent("For local development:");
      log.step(1, "Ensure PostgreSQL container is running:");
      log.cmd("moose dev");
      log.step(2, "Run PostgreSQL setup:");
      log.cmd("pnpm postgres:setup");
      log.newline();
      log.indent("For external database:");
      log.step(1, "Ensure PostgreSQL is running and accessible");
      log.step(2, "Verify environment variables:");
      log.cmd(`DB_HOST=${config.require("DB_HOST")}`);
      log.cmd(`DB_PORT=${config.getNumber("DB_PORT")}`);
      log.cmd(`DB_NAME=${config.require("DB_NAME")}`);
      log.cmd(`DB_USER=${config.require("DB_USER")}`);
      log.step(3, "Create database and schema:");
      log.cmd("pnpm db:push");
      log.step(4, "Seed initial data (optional):");
      log.cmd("pnpm db:seed all 100");
      log.newline();
      process.exit(1);
    }
  } else {
    log.success("Database validation passed!");
    log.bullet("Database connection successful");
    log.bullet("Required tables exist");
  }

  // ============================================================
  // STEP 2: Setup Debezium Connector
  // ============================================================
  await runDebeziumSetup();
}

main().catch((error) => {
  log.newline();
  log.error(`Setup failed: ${error.message}`);
  process.exit(1);
});
