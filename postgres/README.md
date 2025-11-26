# PostgreSQL Setup

PostgreSQL database management for local development with Debezium CDC.

## Structure

```
postgres/
├── src/
│   ├── index.ts      # CLI entry point (setup, seed, clear)
│   ├── db.ts         # Database config, pool, drizzle instance
│   ├── schema.ts     # Drizzle table definitions
│   └── docker.ts     # Container detection & health checks
├── drizzle.config.ts # Drizzle-kit configuration
└── README.md
```

## CLI Commands

```bash
# Full setup (detect container, push schema, seed data)
pnpm postgres:setup

# Seed data
pnpm db:seed all 100              # Seed all tables with 100 records
pnpm db:seed customers 50         # Seed customer_addresses with 50 records
pnpm db:seed another 25           # Seed another_table with 25 records

# Clear data
pnpm db:clear all                 # Clear all tables
pnpm db:clear customers           # Clear customer_addresses
pnpm db:clear another             # Clear another_table

# Schema management
pnpm db:push                      # Push schema to database
pnpm db:studio                    # Open Drizzle Studio GUI
```

## Database Connection

Uses environment variables (via `config/config.ts`):

| Variable      | Description        |
|---------------|--------------------|
| `DB_HOST`     | Database host      |
| `DB_PORT`     | Database port      |
| `DB_NAME`     | Database name      |
| `DB_USER`     | Database user      |
| `DB_PASSWORD` | Database password  |

## Programmatic Usage

```typescript
import { db, getDb, getPool, closePool } from "./db";
import * as schema from "./schema";
import { seedDatabase, clearDatabase } from "./index";

// Query with drizzle
const users = await db.select().from(schema.customerAddresses);

// Seed programmatically
await seedDatabase("customers", 100);

// Clean up
await closePool();
```

## Features

- Auto-detects PostgreSQL Docker container
- Waits for database readiness
- Pushes Drizzle schema with migrations
- Seeds test data with reproducible random sequences
- Lazy-loaded connections (no validation at import time)
