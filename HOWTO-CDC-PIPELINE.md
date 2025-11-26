# HOW-TO: Offload PostgreSQL Analytics to ClickHouse with CDC

A step-by-step guide to building a real-time Change Data Capture (CDC) pipeline that streams PostgreSQL changes to ClickHouse for high-performance analytical queries.

**Stack:** PostgreSQL → Debezium → Redpanda (Kafka) → MooseStack → ClickHouse

---

## Table of Contents

1. [Why This Architecture?](#why-this-architecture)
2. [Architecture Overview](#architecture-overview)
3. [Pipeline Data Flow](#pipeline-data-flow)
4. [Quick Start (5 minutes)](#quick-start-5-minutes)
5. [Project Structure](#project-structure)
6. [Configuration Deep Dive](#configuration-deep-dive)
7. [Connecting Your Own Database](#connecting-your-own-database)
8. [Adding New Tables to the Pipeline](#adding-new-tables-to-the-pipeline)
9. [Troubleshooting](#troubleshooting)

---

## Why This Architecture?

**The Problem:** Your PostgreSQL database is struggling with analytical queries—aggregations, time-series analysis, and ad-hoc reporting slow down your OLTP workload.

**The Solution:** Stream changes from PostgreSQL to ClickHouse in real-time using CDC. Your app keeps writing to PostgreSQL (OLTP), while analytics run against ClickHouse (OLAP) without impacting production.

**Benefits:**

- Zero impact on PostgreSQL performance
- Sub-second latency from write to queryable
- Full history with soft deletes
- Type-safe pipeline with TypeScript

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE LAYER                               │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   PostgreSQL    │  Kafka Connect  │    Redpanda     │      ClickHouse       │
│   (OLTP DB)     │   (Debezium)    │    (Kafka)      │      (OLAP DB)        │
│   Port: 5433    │   Port: 8084    │   Port: 19092   │    Port: 18123        │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         │  WAL Changes    │  CDC Events     │   Transformed      │
         └────────────────►└────────────────►│   Records          │
                                             └───────────────────►│
                                                                  │
┌─────────────────────────────────────────────────────────────────┴───────────┐
│                            MOOSE PIPELINE LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  1-sources/          →    2-transforms/       →    3-destinations/          │
│  (Kafka Topics)           (TypeScript)             (ClickHouse Tables)      │
│                                                                              │
│  pg-cdc.public.*         handleCDCPayload()       ReplacingMergeTree        │
│  - customer_addresses    - Parse CDC event        - customer_addresses      │
│  - another_table         - Handle CRUD ops        - another_table           │
│                          - Add CDC metadata                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component      | Role                      | Technology                                  |
| -------------- | ------------------------- | ------------------------------------------- |
| **PostgreSQL** | Source of truth (OLTP)    | Postgres 14 with `wal_level=logical`        |
| **Debezium**   | Captures WAL changes      | Kafka Connect + Debezium Postgres Connector |
| **Redpanda**   | Message broker            | Kafka-compatible, managed by Moose          |
| **MooseStack** | Pipeline orchestration    | TypeScript transforms, schema management    |
| **ClickHouse** | Analytics database (OLAP) | ReplacingMergeTree for CDC deduplication    |

---

## Pipeline Data Flow

### Table → Topic → Transform → ClickHouse Mapping

```
PostgreSQL Table              Kafka Topic                    ClickHouse Table
──────────────────────────────────────────────────────────────────────────────
public.customer_addresses  →  pg-cdc.public.customer_addresses  →  customer_addresses
public.another_table       →  pg-cdc.public.another_table       →  another_table
```

### Detailed Data Flow

```
1. WRITE TO POSTGRES
   ┌─────────────────────────────────────────────────────────┐
   │  INSERT INTO customer_addresses (first_name, ...)      │
   │  VALUES ('Alice', ...)                                  │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
2. WAL CAPTURE (Debezium)
   ┌─────────────────────────────────────────────────────────┐
   │  Debezium reads PostgreSQL WAL (Write-Ahead Log)        │
   │  Creates CDC event with before/after snapshots          │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
3. KAFKA TOPIC (Redpanda)
   ┌─────────────────────────────────────────────────────────┐
   │  Topic: pg-cdc.public.customer_addresses                │
   │  {                                                      │
   │    "op": "c",           // c=create, u=update, d=delete │
   │    "before": null,      // Previous state (null=insert) │
   │    "after": {           // New state                    │
   │      "id": 1,                                           │
   │      "first_name": "Alice",                             │
   │      ...                                                │
   │    },                                                   │
   │    "source": { "lsn": 12345, "ts_ms": 1699999999 }      │
   │  }                                                      │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
4. MOOSE TRANSFORM (TypeScript)
   ┌─────────────────────────────────────────────────────────┐
   │  // cdc-pipeline/2-transforms/customer-addresses.ts     │
   │  cdcCustomerAddresses.addTransform(                     │
   │    processedCustomerAddresses,                          │
   │    (event) => handleCDCPayload(event)                   │
   │  );                                                     │
   │                                                         │
   │  // Adds: _is_deleted, ts_ms, lsn fields                │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
5. CLICKHOUSE TABLE
   ┌─────────────────────────────────────────────────────────┐
   │  ReplacingMergeTree engine with:                        │
   │  - ver: "lsn" (version for deduplication)               │
   │  - isDeleted: "_is_deleted" (soft delete marker)        │
   │  - orderByFields: ["id"] (primary key)                  │
   │                                                         │
   │  Result: Latest state of each row, deletions filtered   │
   └─────────────────────────────────────────────────────────┘
```

### CDC Operation Handling

| PostgreSQL Operation | Debezium `op` | Transform Behavior                |
| -------------------- | ------------- | --------------------------------- |
| INSERT               | `c` (create)  | Use `after`, set `_is_deleted=0`  |
| UPDATE               | `u` (update)  | Use `after`, set `_is_deleted=0`  |
| DELETE               | `d` (delete)  | Use `before`, set `_is_deleted=1` |
| Initial snapshot     | `r` (read)    | Use `after`, set `_is_deleted=0`  |

---

## Quick Start (5 minutes)

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ and pnpm
- Moose CLI: `bash -i <(curl -fsSL https://fiveonefour.com/install.sh) moose`

### Step 1: Clone & Install

```bash
git clone https://github.com/okane16/debezium-cdc
cd debezium-cdc
pnpm install
```

### Step 2: Start the Dev Environment

```bash
moose dev
```

This single command:

1. Starts ClickHouse and Redpanda (managed by Moose)
2. Starts PostgreSQL and Kafka Connect (via `docker-compose.dev.override.yaml`)
3. Runs `setup-cdc.ts` on first start, which:
   - Validates database connectivity
   - Pushes schema to PostgreSQL (via Drizzle)
   - Seeds initial test data
   - Creates the Debezium connector

### Step 3: Verify the Pipeline

```bash
# In a new terminal - seed more data
pnpm db:seed customers 100

# View CDC events flowing through Kafka
docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --num 5

# Query the data in ClickHouse
curl "http://localhost:18123" --data "SELECT * FROM local.customer_addresses LIMIT 5"
```

### Step 4: Explore with GUI Tools

```bash
# PostgreSQL GUI (make changes here to trigger CDC)
pnpm db:studio    # Opens http://local.drizzle.studio

# ClickHouse GUI (see changes reflected here)
# Visit http://localhost:18123/play
```

---

## Project Structure

```
debezium-cdc/
├── cdc-pipeline/                    # Moose pipeline definition
│   ├── 1-sources/                   # Kafka topic definitions
│   │   ├── externalTopics.ts        # Auto-generated by `moose kafka pull`
│   │   └── typed-topics.ts          # Type-safe wrappers
│   ├── 2-transforms/                # CDC event processors
│   │   ├── payload-handler.ts       # Generic CDC handler (reusable)
│   │   ├── customer-addresses.ts    # Table-specific transform
│   │   └── another-table.ts         # Table-specific transform
│   ├── 3-destinations/              # ClickHouse targets
│   │   ├── olap-tables.ts           # Table definitions (ReplacingMergeTree)
│   │   └── sink-topics.ts           # Streams connecting transforms → tables
│   ├── models.ts                    # Shared TypeScript types
│   └── index.ts                     # Pipeline entry point
│
├── postgres/                        # PostgreSQL management
│   ├── src/
│   │   ├── schema.ts                # Drizzle table definitions
│   │   ├── db.ts                    # Connection pool & config
│   │   ├── docker.ts                # Container detection & health
│   │   └── index.ts                 # CLI: setup, seed, clear
│   ├── drizzle.config.ts            # Drizzle-kit config
│   └── README.md
│
├── debezium/                        # Debezium connector management
│   └── src/
│       ├── resources/
│       │   ├── debezium-connector.ts  # Config generator
│       │   └── kafka-connect.ts       # REST API client
│       └── utils.ts
│
├── config/                          # Shared configuration
│   ├── config.ts                    # Config class (reads .env)
│   └── README.md
│
├── setup-cdc.ts                     # Main orchestration script
├── docker-compose.dev.override.yaml # Dev infrastructure
├── moose.config.toml                # Moose configuration
└── .env.dev                         # Environment variables
```

---

## Configuration Deep Dive

### Environment Variables (.env.dev)

```bash
# ═══════════════════════════════════════════════════════════════
# DATABASE CONNECTION
# ═══════════════════════════════════════════════════════════════
DB_HOST=localhost
DB_PORT=5433
DB_NAME=test-db
DB_USER=postgres
DB_PASSWORD=postgres

# ═══════════════════════════════════════════════════════════════
# CDC / DEBEZIUM CONFIGURATION
# ═══════════════════════════════════════════════════════════════
CDC_CONNECTOR_NAME=postgres-connector
CDC_TOPIC_PREFIX=pg-cdc
CDC_TABLE_INCLUDE_LIST=public.customer_addresses,public.another_table
CDC_PLUGIN_NAME=pgoutput
CDC_SLOT_NAME=debezium_slot
CDC_PUBLICATION_NAME=dbz_publication
CDC_SNAPSHOT_MODE=initial

# ═══════════════════════════════════════════════════════════════
# KAFKA CONNECT
# ═══════════════════════════════════════════════════════════════
KAFKA_CONNECT_PORT=8084
KAFKA_BOOTSTRAP_SERVERS=redpanda:9092
```

### Key Configuration Options

| Variable                 | Description               | Example                                              |
| ------------------------ | ------------------------- | ---------------------------------------------------- |
| `CDC_TOPIC_PREFIX`       | Prefix for Kafka topics   | `pg-cdc` → `pg-cdc.public.table_name`                |
| `CDC_TABLE_INCLUDE_LIST` | Tables to capture         | `public.*` or `public.users,public.orders`           |
| `CDC_SNAPSHOT_MODE`      | Initial data handling     | `initial` (snapshot + stream), `never` (stream only) |
| `CDC_SLOT_NAME`          | Postgres replication slot | Must be unique per connector                         |

---

## Connecting Your Own Database

### Option A: External PostgreSQL (Recommended for Production)

1. **Ensure WAL is enabled** on your PostgreSQL:

   ```sql
   -- Check current setting
   SHOW wal_level;  -- Must be 'logical'

   -- If not, set in postgresql.conf:
   -- wal_level = logical
   -- max_wal_senders = 10
   -- max_replication_slots = 10
   ```

2. **Update `.env.dev`** with your database credentials:

   ```bash
   DB_HOST=your-db-host.example.com
   DB_PORT=5432
   DB_NAME=your_database
   DB_USER=your_user
   DB_PASSWORD=your_password

   CDC_TABLE_INCLUDE_LIST=public.your_table1,public.your_table2
   ```

3. **Comment out the local postgres service** in `docker-compose.dev.override.yaml`:

   ```yaml
   # postgres:
   #   image: postgres:14
   #   ...
   ```

4. **Run the setup**:
   ```bash
   moose dev
   # Or manually: pnpm cdc:setup
   ```

### Option B: Local PostgreSQL (Default for Development)

The default configuration uses a local PostgreSQL container. Just run:

```bash
moose dev
```

The container is defined in `docker-compose.dev.override.yaml` with WAL already configured.

---

## Adding New Tables to the Pipeline

### Step 1: Define the PostgreSQL Schema

```typescript
// postgres/src/schema.ts
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customer_id: integer("customer_id").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type Order = typeof orders.$inferSelect;
```

### Step 2: Add to CDC Table List

```bash
# .env.dev
CDC_TABLE_INCLUDE_LIST=public.customer_addresses,public.another_table,public.orders
```

### Step 3: Pull Kafka Schema

```bash
# After the connector is running with the new table
pnpm dev:kafka:pull
```

### Step 4: Create Type-Safe Topic Wrapper

```typescript
// cdc-pipeline/1-sources/typed-topics.ts
import { PgCdcPublicOrdersStream } from "./externalTopics";
import { Order } from "../../postgres/src/schema";

export const cdcOrders = PgCdcPublicOrdersStream as unknown as Stream<
  GenericCDCEvent<Order>
>;
```

### Step 5: Define OLAP Type

```typescript
// cdc-pipeline/models.ts
export type OlapOrder = Omit<Order, "id" | "total"> &
  CdcFields & {
    id: UInt64;
    total: string; // Numeric as string for precision
  };
```

### Step 6: Create ClickHouse Table

```typescript
// cdc-pipeline/3-destinations/olap-tables.ts
export const olapOrders = new OlapTable<OlapOrder>("orders", {
  engine: ClickHouseEngines.ReplacingMergeTree,
  ver: "lsn",
  isDeleted: "_is_deleted",
  orderByFields: ["id"],
});
```

### Step 7: Create Sink Stream

```typescript
// cdc-pipeline/3-destinations/sink-topics.ts
export const processedOrders = new Stream<OlapOrder>("ProcessedOrders", {
  destination: olapOrders,
});
```

### Step 8: Create Transform

```typescript
// cdc-pipeline/2-transforms/orders.ts
import { cdcOrders } from "../1-sources/typed-topics";
import { processedOrders } from "../3-destinations/sink-topics";
import { handleCDCPayload } from "./payload-handler";

cdcOrders.addTransform(processedOrders, (message) => {
  return handleCDCPayload(message) as OlapOrder;
});
```

### Step 9: Restart and Test

```bash
# Restart to pick up changes
moose dev

# Seed the new table
# (add seeding logic to postgres/src/index.ts if needed)
```

---

## Troubleshooting

### Connector Not Starting

```bash
# Check connector status
curl http://localhost:8084/connectors/postgres-connector/status | jq .

# View Kafka Connect logs
docker logs kafka-connect-cdc -f

# Common issues:
# - Database not reachable (check DB_HOST)
# - WAL level not set to 'logical'
# - Replication slot already exists (drop and recreate)
```

### No Data in ClickHouse

```bash
# Verify topics exist
docker exec debezium-cdc-redpanda-1 rpk topic list

# Check if messages are flowing
docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --num 1

# Check Moose logs for transform errors
# (visible in the terminal running `moose dev`)
```

### Reset Everything

```bash
# Stop Moose (Ctrl+C)

# Tear down all containers and volumes
docker compose -f docker-compose.dev.override.yaml down -v --remove-orphans
docker volume prune -f

# Start fresh
moose dev
```

### Useful Commands

```bash
# Database
pnpm postgres:setup          # Full setup (schema + seed)
pnpm db:seed customers 100   # Seed specific table
pnpm db:clear all            # Clear all tables
pnpm db:studio               # Open GUI

# Kafka
docker exec debezium-cdc-redpanda-1 rpk topic list
docker exec debezium-cdc-redpanda-1 rpk topic consume <topic> --num 5

# Connector
curl http://localhost:8084/connectors                              # List
curl http://localhost:8084/connectors/postgres-connector/status    # Status
curl -X DELETE http://localhost:8084/connectors/postgres-connector # Delete

# ClickHouse
curl "http://localhost:18123" --data "SELECT * FROM local.customer_addresses LIMIT 10"
curl "http://localhost:18123" --data "SELECT count() FROM local.customer_addresses"
```

---

## Summary

This repository demonstrates a production-ready pattern for CDC pipelines:

1. **PostgreSQL** → Your existing OLTP database (or the included test database)
2. **Debezium** → Captures WAL changes with exactly-once semantics
3. **Redpanda** → Kafka-compatible broker for reliable message delivery
4. **MooseStack** → Type-safe TypeScript transforms with schema management
5. **ClickHouse** → ReplacingMergeTree handles updates/deletes automatically

The entire pipeline is defined in code, version-controlled, and reproducible. Clone, configure your database, and run `moose dev`—you'll have real-time CDC flowing in minutes.

---

## References

- [Debezium Documentation](https://debezium.io/documentation/)
- [MooseStack Documentation](https://docs.moosejs.com/)
- [ClickHouse ReplacingMergeTree](https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replacingmergetree)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Redpanda](https://docs.redpanda.com/)
