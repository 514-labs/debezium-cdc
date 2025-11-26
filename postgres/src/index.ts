#!/usr/bin/env npx ts-node
/**
 * PostgreSQL CLI
 *
 * Commands:
 *   setup                    - Detect container, wait for ready, push schema, seed
 *   seed <table> [count]     - Seed table(s) with data
 *   clear <table>            - Clear table(s)
 *
 * Tables: customers, another, all
 */

import { Config } from "../../config/config";
import { getPostgresContainer, waitForPostgres, pushSchema } from "./docker";
import { getPool, getDb, closePool } from "./db";
import * as schema from "./schema";
import { seed, reset } from "drizzle-seed";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Seed Operations
// ─────────────────────────────────────────────────────────────────────────────

async function seedCustomerAddresses(count: number, seedValue: number) {
  const db = getDb();
  await seed(
    db,
    { customerAddresses: schema.customerAddresses },
    { seed: seedValue }
  ).refine((f) => ({
    customerAddresses: {
      count,
      columns: {
        id: f.default({
          defaultValue: sql`nextval('customer_addresses_id_seq')`,
        }),
        first_name: f.firstName(),
        last_name: f.lastName(),
        email: f.email(),
        res_address: f.streetAddress(),
        work_address: f.streetAddress(),
        country: f.country(),
        state: f.state(),
        phone_1: f.phoneNumber(),
        phone_2: f.phoneNumber(),
      },
    },
  }));
}

async function seedAnotherTable(count: number, seedValue: number) {
  const db = getDb();
  await seed(
    db,
    { anotherTable: schema.anotherTable },
    { seed: seedValue }
  ).refine((f) => ({
    anotherTable: {
      count,
      columns: {
        id: f.default({ defaultValue: sql`nextval('another_table_id_seq')` }),
        name: f.fullName(),
        description: f.loremIpsum({ sentencesCount: 3 }),
        random_number: f.int({ minValue: 1, maxValue: 1000 }),
      },
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear Operations
// ─────────────────────────────────────────────────────────────────────────────

async function clearCustomerAddresses() {
  const db = getDb();
  await reset(db, { customerAddresses: schema.customerAddresses });
}

async function clearAnotherTable() {
  const db = getDb();
  await reset(db, { anotherTable: schema.anotherTable });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDatabase(
  table: string,
  count: number = 1000,
  seedValue: number = Math.floor(Math.random() * 1000000)
): Promise<void> {
  console.log(`🌱 Seeding ${table} with ${count} records...`);

  switch (table) {
    case "customers":
      await seedCustomerAddresses(count, seedValue);
      break;
    case "another":
      await seedAnotherTable(count, seedValue);
      break;
    case "all":
    default:
      await seedCustomerAddresses(count, seedValue);
      await seedAnotherTable(count, seedValue);
  }

  console.log("✅ Seeding complete!");
}

export async function clearDatabase(table: string): Promise<void> {
  console.log(`🗑️  Clearing ${table}...`);

  switch (table) {
    case "customers":
      await clearCustomerAddresses();
      break;
    case "another":
      await clearAnotherTable();
      break;
    case "all":
      await clearCustomerAddresses();
      await clearAnotherTable();
      break;
    default:
      throw new Error("Invalid table. Use: customers, another, or all");
  }

  console.log("✅ Clear complete!");
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Commands
// ─────────────────────────────────────────────────────────────────────────────

async function cmdSetup() {
  const { hasLocalDb, postgresContainerName } = await getPostgresContainer();

  if (!hasLocalDb || !postgresContainerName) {
    console.log("⚠️  No local PostgreSQL container detected");
    process.exit(1);
  }

  console.log(`🔍 Detected PostgreSQL container: ${postgresContainerName}`);

  const config = new Config();
  await waitForPostgres(config, postgresContainerName);
  pushSchema();
  await seedDatabase("all", 1000, 1);

  console.log("\n✅ PostgreSQL setup complete!");
}

async function cmdSeed(table: string, count: number, seedValue: number) {
  await seedDatabase(table, count, seedValue);
}

async function cmdClear(table: string) {
  await clearDatabase(table);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Entry Point
// ─────────────────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
PostgreSQL CLI

Commands:
  setup                      Setup database (schema + seed)
  seed <table> [count]       Seed table with data
  clear <table>              Clear table data

Tables: customers, another, all

Examples:
  npx ts-node src/index.ts setup
  npx ts-node src/index.ts seed customers 100
  npx ts-node src/index.ts clear all
`);
}

async function main() {
  const [command, arg1, arg2, arg3] = process.argv.slice(2);

  try {
    switch (command) {
      case "setup":
        await cmdSetup();
        break;

      case "seed": {
        const table = arg1 || "all";
        const count = arg2 ? parseInt(arg2) : 1000;
        const seedVal = arg3
          ? parseInt(arg3)
          : Math.floor(Math.random() * 1000000);
        await cmdSeed(table, count, seedVal);
        break;
      }

      case "clear":
        if (!arg1) {
          console.error("❌ Please specify table: customers, another, or all");
          process.exit(1);
        }
        await cmdClear(arg1);
        break;

      case "help":
      case "--help":
      case "-h":
        showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}
