import { db, pool } from "./connection";
import { customerAddresses, anotherTable } from "./schema";
import { sql } from "drizzle-orm";
import { faker } from "@faker-js/faker";

// ============================================================================
// Data Generators - Create fake data for each table
// ============================================================================

const generateRandomCustomer = () => {
  const first_name = faker.person.firstName();
  const last_name = faker.person.lastName();
  return {
    first_name: first_name,
    last_name: last_name,
    email: faker.internet.email({
      firstName: first_name,
      lastName: last_name,
    }),
    res_address: faker.location.streetAddress(),
    work_address: faker.location.streetAddress(),
    country: faker.location.country(),
    state: faker.location.state(),
    phone_1: faker.phone.number({ style: "national" }),
    phone_2: faker.phone.number({ style: "national" }),
  };
};

const generateRandomAnotherTable = () => {
  return {
    name: faker.lorem.word(),
    description: faker.lorem.sentence(),
    random_number: faker.number.int({ min: 1, max: 1000 }),
  };
};

// ============================================================================
// Seed Functions - Insert data into specific tables
// ============================================================================

async function seedCustomerAddresses(count: number = 10) {
  const BATCH_SIZE = 1000;
  console.log(`🌱 Seeding customer_addresses with ${count} records...`);
  console.log(`📦 Using batch size: ${BATCH_SIZE}`);

  // Check current count
  const currentCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerAddresses);
  console.log(`📊 Current count: ${currentCount[0].count}\n`);

  const startTime = Date.now();
  let insertedCount = 0;

  // Insert in batches for better performance
  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, count - i);
    const batch = Array.from({ length: batchSize }, generateRandomCustomer);
    await db.insert(customerAddresses).values(batch);

    insertedCount += batchSize;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const rate = ((insertedCount / (Date.now() - startTime)) * 1000).toFixed(0);

    console.log(
      `✅ Progress: ${insertedCount}/${count} (${(
        (insertedCount / count) *
        100
      ).toFixed(1)}%) | ${elapsed}s elapsed | ${rate} records/sec`
    );
  }

  // Show final stats
  const finalCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerAddresses);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgRate = ((count / (Date.now() - startTime)) * 1000).toFixed(0);

  console.log(`\n✨ Seeding complete! Total records: ${finalCount[0].count}`);
  console.log(
    `⏱️  Total time: ${totalTime}s | Average: ${avgRate} records/sec`
  );
  console.log(`🔄 CDC events generated for ${count} INSERT operations\n`);
}

async function seedAnotherTable(count: number = 10) {
  const BATCH_SIZE = 1000;
  console.log(`🌱 Seeding another_table with ${count} records...`);
  console.log(`📦 Using batch size: ${BATCH_SIZE}`);

  // Check current count
  const currentCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(anotherTable);
  console.log(`📊 Current count: ${currentCount[0].count}\n`);

  const startTime = Date.now();
  let insertedCount = 0;

  // Insert in batches for better performance
  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, count - i);
    const batch = Array.from({ length: batchSize }, generateRandomAnotherTable);
    await db.insert(anotherTable).values(batch);

    insertedCount += batchSize;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const rate = ((insertedCount / (Date.now() - startTime)) * 1000).toFixed(0);

    console.log(
      `✅ Progress: ${insertedCount}/${count} (${(
        (insertedCount / count) *
        100
      ).toFixed(1)}%) | ${elapsed}s elapsed | ${rate} records/sec`
    );
  }

  // Show final stats
  const finalCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(anotherTable);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgRate = ((count / (Date.now() - startTime)) * 1000).toFixed(0);

  console.log(`\n✨ Seeding complete! Total records: ${finalCount[0].count}`);
  console.log(
    `⏱️  Total time: ${totalTime}s | Average: ${avgRate} records/sec`
  );
  console.log(`🔄 CDC events generated for ${count} INSERT operations\n`);
}

async function seedAll(count: number = 10) {
  console.log(`🌱 Seeding ALL tables with ${count} records each...\n`);
  const startTime = Date.now();

  await seedCustomerAddresses(count);
  await seedAnotherTable(count);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✨ All tables seeded! Total time: ${totalTime}s`);
}

// ============================================================================
// Clear Functions - Delete data from specific tables
// ============================================================================

async function clearCustomerAddresses() {
  console.log("🗑️  Clearing customer_addresses...");
  const result = await db.delete(customerAddresses).returning();
  console.log(
    `✅ Deleted ${result.length} records (CDC DELETE events generated)\n`
  );
}

async function clearAnotherTable() {
  console.log("🗑️  Clearing another_table...");
  const result = await db.delete(anotherTable).returning();
  console.log(
    `✅ Deleted ${result.length} records (CDC DELETE events generated)\n`
  );
}

async function clearAll() {
  console.log("🗑️  Clearing ALL tables...\n");
  await clearCustomerAddresses();
  await clearAnotherTable();
  console.log("✨ All tables cleared!");
}

// ============================================================================
// CLI - Command-line interface for seeding/clearing tables
// ============================================================================

async function main() {
  const command = process.argv[2];
  const table = process.argv[3];
  const countArg = process.argv[4];

  try {
    if (command === "seed") {
      const count = countArg ? parseInt(countArg) : 10;

      switch (table) {
        case "customers":
          await seedCustomerAddresses(count);
          break;
        case "another":
          await seedAnotherTable(count);
          break;
        case "all":
          await seedAll(count);
          break;
        default:
          console.log("❌ Invalid table. Use: customers, another, or all");
          process.exit(1);
      }
    } else if (command === "clear") {
      switch (table) {
        case "customers":
          await clearCustomerAddresses();
          break;
        case "another":
          await clearAnotherTable();
          break;
        case "all":
          await clearAll();
          break;
        default:
          console.log("❌ Invalid table. Use: customers, another, or all");
          process.exit(1);
      }
    } else {
      // Show help
      console.log("🛠️  CDC Database Seeding Tool\n");
      console.log("Usage:");
      console.log(
        "  pnpm db:seed <table> [count]   - Seed specific table with random data"
      );
      console.log(
        "  pnpm db:clear <table>          - Clear data from specific table"
      );
      console.log("\nTables:");
      console.log("  customers  - customer_addresses table");
      console.log("  another    - another_table");
      console.log("  all        - all tables");
      console.log("\nExamples:");
      console.log(
        "  pnpm db:seed customers 100     - Create 100 random customers"
      );
      console.log(
        "  pnpm db:seed another 50        - Create 50 records in another_table"
      );
      console.log(
        "  pnpm db:seed all 1000          - Seed all tables with 1000 records each"
      );
      console.log(
        "  pnpm db:clear customers        - Clear customer_addresses"
      );
      console.log("  pnpm db:clear all              - Clear all tables");
      console.log(
        "\n💡 Use 'pnpm db:studio' to open Drizzle Studio for visual management"
      );
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
