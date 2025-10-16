import { db, pool } from "./connection";
import { customerAddresses } from "./schema";
import { sql } from "drizzle-orm";
import { faker } from "@faker-js/faker";

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

async function seedDatabase(count: number = 1000) {
  const BATCH_SIZE = 1000;
  console.log(`🌱 Seeding database with ${count} random customers...`);
  console.log(`📦 Using batch size: ${BATCH_SIZE}`);

  try {
    // Check current count
    const currentCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerAddresses);
    console.log(`📊 Current customer count: ${currentCount[0].count}\n`);

    const startTime = Date.now();
    let insertedCount = 0;

    // Insert in batches for better performance
    for (let i = 0; i < count; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, count - i);

      // Generate batch of customers
      const customers = Array.from({ length: batchSize }, () =>
        generateRandomCustomer()
      );

      // Insert entire batch at once
      await db.insert(customerAddresses).values(customers);

      insertedCount += batchSize;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const rate = ((insertedCount / (Date.now() - startTime)) * 1000).toFixed(
        0
      );

      console.log(
        `✅ Progress: ${insertedCount}/${count} (${(
          (insertedCount / count) *
          100
        ).toFixed(1)}%) | ${elapsed}s elapsed | ${rate} records/sec`
      );
    }

    // Show final count and stats
    const finalCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerAddresses);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgRate = ((count / (Date.now() - startTime)) * 1000).toFixed(0);

    console.log(
      `\n✨ Seeding complete! Total customers: ${finalCount[0].count}`
    );
    console.log(
      `⏱️  Total time: ${totalTime}s | Average: ${avgRate} records/sec`
    );
    console.log(
      `🔄 CDC events generated for ${count} INSERT operations via Debezium`
    );
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function clearDatabase() {
  console.log("🗑️  Clearing all customers from database...");

  try {
    const result = await db.delete(customerAddresses).returning();
    console.log(
      `✅ Deleted ${result.length} customers (CDC DELETE events generated)`
    );
  } catch (error) {
    console.error("❌ Error clearing database:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Main CLI
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case "seed":
    const count = arg ? parseInt(arg) : 10;
    seedDatabase(count);
    break;

  case "clear":
    clearDatabase();
    break;

  default:
    console.log("🛠️  CDC Database Seeding Tool\n");
    console.log("Usage:");
    console.log(
      "  pnpm db:seed [count]  - Seed database with random customers (default: 10)"
    );
    console.log("  pnpm db:clear         - Clear all customers");
    console.log("\nExamples:");
    console.log("  pnpm db:seed 5        - Create 5 random customers");
    console.log("  pnpm db:seed 100000   - Create 100k customers (batched)");
    console.log("  pnpm db:clear         - Delete all customers");
    console.log(
      "\n💡 Use 'pnpm db:studio' to open Drizzle Studio for visual database management"
    );
    process.exit(0);
}
