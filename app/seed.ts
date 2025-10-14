import { db, pool } from "./db";
import { customerAddresses } from "./db/schema";
import { sql } from "drizzle-orm";

// Sample data for random generation
const firstNames = [
  "John",
  "Jane",
  "Bob",
  "Alice",
  "Charlie",
  "Sarah",
  "Mike",
  "Emma",
  "David",
  "Lisa",
  "Tom",
  "Maria",
  "James",
  "Anna",
  "Chris",
];
const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
];
const domains = [
  "example.com",
  "test.com",
  "demo.com",
  "sample.org",
  "mock.net",
];
const streets = [
  "Main St",
  "Oak Ave",
  "Pine Rd",
  "Elm St",
  "Maple Dr",
  "Cedar Ln",
  "Park Ave",
];
const states = [
  "California",
  "New York",
  "Texas",
  "Florida",
  "Illinois",
  "Pennsylvania",
  "Ohio",
];
const countries = [
  "USA",
  "Canada",
  "Mexico",
  "UK",
  "Germany",
  "France",
  "Spain",
  "Italy",
];

// Helper functions
const getRandomElement = <T>(array: T[]): T =>
  array[Math.floor(Math.random() * array.length)];
const getRandomNumber = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomPhone = (): string =>
  `${getRandomNumber(100, 999)}-${getRandomNumber(100, 999)}-${getRandomNumber(
    1000,
    9999
  )}`;

const generateRandomCustomer = () => {
  const firstName = getRandomElement(firstNames);
  const lastName = getRandomElement(lastNames);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${getRandomElement(
    domains
  )}`;
  const resAddress = `${getRandomNumber(100, 9999)} ${getRandomElement(
    streets
  )}`;
  const workAddress = `${getRandomNumber(100, 9999)} ${getRandomElement(
    streets
  )}`;
  const country = getRandomElement(countries);
  const state = getRandomElement(states);
  const phone1 = getRandomPhone();
  const phone2 = getRandomPhone();

  return {
    first_name: firstName,
    last_name: lastName,
    email,
    res_address: resAddress,
    work_address: workAddress,
    country,
    state,
    phone_1: phone1,
    phone_2: phone2,
  };
};

async function seedDatabase(count: number = 10) {
  console.log(`🌱 Seeding database with ${count} random customers...`);

  try {
    // Check current count
    const currentCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerAddresses);
    console.log(`📊 Current customer count: ${currentCount[0].count}`);

    // Insert random customers
    for (let i = 0; i < count; i++) {
      const customer = generateRandomCustomer();
      const result = await db
        .insert(customerAddresses)
        .values(customer)
        .returning();

      console.log(
        `✅ Created customer ${i + 1}/${count}: ${result[0].first_name} ${
          result[0].last_name
        } (ID: ${result[0].id})`
      );
    }

    // Show final count
    const finalCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerAddresses);
    console.log(
      `\n✨ Seeding complete! Total customers: ${finalCount[0].count}`
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

async function listCustomers() {
  console.log("📋 Listing all customers...\n");

  try {
    const customers = await db
      .select()
      .from(customerAddresses)
      .orderBy(customerAddresses.id);

    console.log(`Found ${customers.length} customers:`);
    console.log("─".repeat(80));

    customers.forEach((customer) => {
      console.log(
        `ID: ${customer.id.toString().padEnd(4)} | ${customer.first_name} ${
          customer.last_name
        } | ${customer.email}`
      );
      console.log(
        `       ${customer.res_address || "No address"} | ${
          customer.state || "N/A"
        }, ${customer.country || "N/A"}`
      );
      console.log("─".repeat(80));
    });
  } catch (error) {
    console.error("❌ Error listing customers:", error);
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

  case "list":
    listCustomers();
    break;

  case "clear":
    clearDatabase();
    break;

  default:
    console.log("🛠️  CDC Database Seeding Tool\n");
    console.log("Usage:");
    console.log(
      "  pnpm seed [count]     - Seed database with random customers (default: 10)"
    );
    console.log("  pnpm list             - List all customers");
    console.log("  pnpm clear            - Clear all customers");
    console.log("\nExamples:");
    console.log("  pnpm seed 5           - Create 5 random customers");
    console.log("  pnpm list             - View all customers");
    console.log("  pnpm clear            - Delete all customers");
    console.log(
      "\n💡 Use 'pnpm db:studio' to open Drizzle Studio for visual database management"
    );
    process.exit(0);
}
