#!/usr/bin/env npx ts-node
/**
 * Debezium CDC Setup Script
 *
 * Main orchestration script that coordinates:
 * - Configuration loading
 * - Database connectivity check
 * - Kafka Connect operations
 * - Connector creation
 *
 * Usage:
 *   npx ts-node debezium/src/index.ts              # Setup connector
 *   npx ts-node debezium/src/index.ts --dry-run    # Show generated config
 */

import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { Config } from "../../config/config";
import { generateConnectorConfig } from "./resources/debezium-connector";
import {
  waitForKafkaConnect,
  deleteConnectorIfExists,
  createConnector,
} from "./resources/kafka-connect";
import { isMooseRunning } from "./utils";

async function checkDatabaseConnectivity(config: Config): Promise<boolean> {
  const pool = new Pool({
    host: config.require("DB_HOST"),
    port: config.getNumber("DB_PORT")!,
    database: config.require("DB_NAME"),
    user: config.require("DB_USER"),
    password: config.require("DB_PASSWORD"),
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    await pool.end();
    return false;
  }
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
  console.log(`
🚀 Setting up Debezium CDC
════════════════════════════════════════════════════════════════
  Database:    ${config.require("DB_NAME")}@${config.require(
    "DB_HOST"
  )}:${config.getNumber("DB_PORT")}
  Tables:      ${config.require("CDC_TABLE_INCLUDE_LIST")}
  Topics:      ${config.require("CDC_TOPIC_PREFIX")}.*
  Connector:   ${config.require("CDC_CONNECTOR_NAME")}
════════════════════════════════════════════════════════════════
`);

  // Dry run - just show config
  if (dryRun) {
    console.log("📋 Generated connector configuration:\n");
    console.log(JSON.stringify(connectorConfig, null, 2));
    return;
  }

  // Check database connectivity
  console.log("🔍 Checking database connectivity...");
  const dbAvailable = await checkDatabaseConnectivity(config);
  if (!dbAvailable) {
    console.log(
      `⚠️  Database not available at ${config.require(
        "DB_HOST"
      )}:${config.getNumber("DB_PORT")}`
    );
    console.log(`\nPlease ensure PostgreSQL is running and accessible.`);
    console.log(`\nFor local development:`);
    console.log(`  pnpm postgres:setup    # Setup local database`);
    console.log(
      `  moose dev              # Start Moose dev server (includes postgres)`
    );
    console.log(`\nFor external database:`);
    console.log(
      `  Ensure DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD are set correctly`
    );
    process.exit(1);
  }
  console.log("✅ Database is available!");

  // Check if Moose is running
  console.log("\n🔍 Checking if Moose dev server is running...");
  if (!isMooseRunning()) {
    console.log("⚠️  Moose dev server not detected on port 19092");
    console.log("\nPlease start Moose dev server first:");
    console.log("  moose dev");
    process.exit(1);
  }
  console.log("✅ Moose dev server is running!");

  // Wait for Kafka Connect
  const kafkaConnectPort = config.getNumber("KAFKA_CONNECT_PORT")!;
  const kafkaConnectUrl = `http://localhost:${kafkaConnectPort}`;
  console.log("");
  await waitForKafkaConnect(kafkaConnectUrl);

  // Save generated config for reference
  console.log("\n🔧 Generating connector configuration...");
  const configPath = path.join(process.cwd(), "postgres-connector.json");
  fs.writeFileSync(configPath, JSON.stringify(connectorConfig, null, 2));
  console.log(`   Saved to postgres-connector.json`);

  // Delete existing connector if present
  await deleteConnectorIfExists(
    kafkaConnectUrl,
    config.require("CDC_CONNECTOR_NAME")
  );

  // Create connector
  console.log("");
  await createConnector(kafkaConnectUrl, connectorConfig);

  const connectorName = config.require("CDC_CONNECTOR_NAME");
  const topicPrefix = config.require("CDC_TOPIC_PREFIX");
  const tableIncludeList = config.require("CDC_TABLE_INCLUDE_LIST");

  // Success message (mirrors Pulumi deployment instructions)
  console.log(`
════════════════════════════════════════════════════════════════
🎉 CDC Setup Complete!
════════════════════════════════════════════════════════════════

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

  # Database management (if using local database)
  pnpm db:studio    # Open database GUI
  pnpm db:seed all 100  # Seed more data
`);
}

main().catch((error) => {
  console.error("❌ Setup failed:", error.message);
  process.exit(1);
});
