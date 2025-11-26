#!/usr/bin/env npx ts-node
/**
 * Debezium CDC Setup Script
 *
 * Main orchestration script that coordinates:
 * - Configuration loading
 * - Database setup (if local)
 * - Kafka Connect operations
 * - Connector creation
 *
 * Usage:
 *   npx ts-node scripts/setup-cdc.ts              # Setup connector
 *   npx ts-node scripts/setup-cdc.ts --dry-run    # Show generated config
 */

import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "./resources/config";
import { generateConnectorConfig } from "./resources/debezium-connector";
import {
  waitForKafkaConnect,
  deleteConnectorIfExists,
  createConnector,
} from "./resources/kafka-connect";
import {
  isPostgresContainerRunning,
  getPostgresContainerName,
  waitForPostgres,
  setupLocalDatabase,
} from "./resources/postgres";
import { isMooseRunning } from "./utils";

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // Auto-detect if local postgres container is running
  const hasLocalDb = isPostgresContainerRunning();
  const postgresContainerName = hasLocalDb ? getPostgresContainerName()! : null;

  if (hasLocalDb) {
    console.log(
      `🔍 Detected local postgres container (${postgresContainerName}) - will setup test database`
    );
  } else {
    console.log(
      "🔍 No local postgres container - using external database mode"
    );
  }

  // Load configuration (pass hasLocalDb to set appropriate defaults)
  const config = loadConfig(hasLocalDb);

  // Generate connector configuration (uses config values only)
  const connectorConfig = generateConnectorConfig(config);

  // Display configuration summary
  console.log(`
🚀 Setting up Debezium CDC
════════════════════════════════════════════════════════════════
  Database:    ${config.database.name}@${config.database.hostname}:${
    config.database.port
  }
  Tables:      ${config.cdc.tableIncludeList}
  Topics:      ${config.cdc.topicPrefix}.*
  Connector:   ${config.cdc.connectorName}
  Mode:        ${
    hasLocalDb
      ? "Local test database (with seeding)"
      : "External database (connector only)"
  }
════════════════════════════════════════════════════════════════
`);

  // Dry run - just show config
  if (dryRun) {
    console.log("📋 Generated connector configuration:\n");
    console.log(JSON.stringify(connectorConfig, null, 2));
    return;
  }

  // Check if Moose is running
  console.log("🔍 Checking if Moose dev server is running...");
  if (!isMooseRunning()) {
    console.log("⚠️  Moose dev server not detected on port 19092");
    console.log("\nPlease start Moose dev server first:");
    console.log("  moose dev");
    console.log(
      "\nTo include local test database, ensure postgres service is enabled in docker-compose.dev.override.yaml"
    );
    process.exit(1);
  }
  console.log("✅ Moose dev server is running!");

  // Setup local database if detected
  if (hasLocalDb && postgresContainerName) {
    await waitForPostgres(config, postgresContainerName);
    setupLocalDatabase();
  }

  // Wait for Kafka Connect
  console.log("");
  await waitForKafkaConnect(config.kafkaConnect.url);

  // Save generated config for reference
  console.log("\n🔧 Generating connector configuration...");
  const configPath = path.join(process.cwd(), "postgres-connector.json");
  fs.writeFileSync(configPath, JSON.stringify(connectorConfig, null, 2));
  console.log(`   Saved to postgres-connector.json`);

  // Delete existing connector if present
  await deleteConnectorIfExists(
    config.kafkaConnect.url,
    config.cdc.connectorName
  );

  // Create connector
  console.log("");
  await createConnector(config.kafkaConnect.url, connectorConfig);

  // Success message (mirrors Pulumi deployment instructions)
  console.log(`
════════════════════════════════════════════════════════════════
🎉 CDC Setup Complete!
════════════════════════════════════════════════════════════════

Your CDC pipeline is streaming changes from:
  ${config.cdc.tableIncludeList} → ${config.cdc.topicPrefix}.*

📋 Quick Commands:

  # Check connector status
  curl ${config.kafkaConnect.url}/connectors/${config.cdc.connectorName}/status | jq .

  # View CDC events
  docker exec debezium-cdc-redpanda-1 rpk topic consume ${config.cdc.topicPrefix}.public.customer_addresses --num 5

  # Manage connector
  curl -X PUT ${config.kafkaConnect.url}/connectors/${config.cdc.connectorName}/pause   # Pause
  curl -X PUT ${config.kafkaConnect.url}/connectors/${config.cdc.connectorName}/resume  # Resume
  curl -X DELETE ${config.kafkaConnect.url}/connectors/${config.cdc.connectorName}      # Delete
`);

  if (hasLocalDb) {
    console.log(`  # Open database GUI
  pnpm db:studio

  # Seed more data
  pnpm db:seed all 100
`);
  }
}

main().catch((error) => {
  console.error("❌ Setup failed:", error.message);
  process.exit(1);
});
