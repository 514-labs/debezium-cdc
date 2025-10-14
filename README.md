# Debezium CDC with Moose & Drizzle

A complete **Change Data Capture (CDC)** demo showcasing real-time database change streaming using Debezium, PostgreSQL, Kafka/Redpanda, Moose, and Drizzle ORM with Apicurio Schema Registry for JSON Schema serialization.

## 🎯 What This Demo Does

This project demonstrates a production-ready CDC pipeline:

- 📊 **Capture database changes** in real-time using Debezium
- 🔄 **Stream CDC events** through Kafka/Redpanda with JSON Schema validation
- 📝 **Register schemas** automatically in Apicurio Schema Registry
- 🚀 **Process events** with Moose for real-time analytics
- 🎨 **Manage data visually** with Drizzle Studio GUI
- 💾 **Store in ClickHouse** for analytics queries

## 🏗️ Architecture

```
┌─────────────────────┐
│  Drizzle Studio     │  ← GUI for creating/editing/deleting records
│  (localhost:4983)   │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   PostgreSQL DB     │  ← Source database (customer_addresses table)
│   (localhost:5433)  │
└──────────┬──────────┘
           ↓ (Write-Ahead Log)
┌─────────────────────┐
│  Debezium Connector │  ← Captures INSERT/UPDATE/DELETE operations
│  (Kafka Connect)    │
└──────────┬──────────┘
           ↓ (JSON Schema)
┌─────────────────────┐
│ Apicurio Registry   │  ← Stores JSON Schema definitions
│ (localhost:8081)    │     Auto-registers key & value schemas
└──────────┬──────────┘
           ↓ (Serialized with schemaId)
┌─────────────────────┐
│ Redpanda (Kafka)    │  ← Message broker for CDC events
│ (localhost:19092)   │     Topic: pg-cdc.public.customer_addresses
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   Moose Framework   │  ← Consumes & processes CDC events
│   (localhost:4000)  │     Check terminal for event logs!
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│    ClickHouse       │  ← Analytics database for processed data
│   (localhost:18123) │
└─────────────────────┘
```

### Key Components

- **Drizzle Studio**: Visual database GUI - create, edit, delete records and immediately see CDC events
- **Debezium**: Monitors PostgreSQL WAL and captures all changes as CDC events
- **Apicurio Registry**: Schema registry that validates message structure using JSON Schema
- **Redpanda**: Kafka-compatible broker that streams CDC events
- **Moose**: Real-time data processing framework that consumes and transforms CDC events

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for running infrastructure)
- **Node.js 16+** and **pnpm** (for Moose and Drizzle)
- **Moose CLI**: `npm install -g @514labs/moose-cli`

### Step 1: Clone and Install

```bash
git clone okane16/debezium-cdc
cd debezium-cdc
pnpm install
```

### Step 2: Start Moose Dev Server

```bash
pnpm dev
```

**Keep this terminal open!** This command:

- ✅ Starts Moose's core infrastructure (Redpanda, ClickHouse)
- ✅ Automatically loads CDC services from `docker-compose.dev.override.yaml`
- ✅ Starts the Moose application that consumes CDC events
- ✅ Runs `./setup-cdc.sh` automatically on first start (creates Debezium connector)

You'll see logs like:

```
[cdcCustomerAddresses] Processing CDC event...
```

**This is where you'll see CDC events in real-time!**

### Step 3: Open Drizzle Studio

In a **new terminal**:

```bash
pnpm db:studio
```

Opens at **http://localhost:4983**

### Step 4: Test the CDC Pipeline

Now test the complete pipeline:

1. **Open Drizzle Studio** (http://localhost:4983)
2. **Click on `customer_addresses` table**
3. **Click "Add Row"** and create a new customer
4. **Watch your Moose terminal** - you'll see the CDC INSERT event appear!
5. **Edit a field** in Drizzle Studio
6. **Watch the Moose terminal again** - you'll see the CDC UPDATE event!

**Example CDC event in Moose logs:**

```json
[cdcCustomerAddresses] {
  "op": "c",
  "after": {"id": 1, "first_name": "John", "last_name": "Doe", ...},
  "source": {"version": "3.3.0.Final", "connector": "postgresql", ...}
}
```

### Alternative: Generate Test Data via CLI

```bash
# Create 10 random customers (triggers 10 CDC INSERT events)
pnpm db:seed

# Create specific number
pnpm db:seed 20

# Create large dataset (uses batch inserts)
pnpm db:seed 100000

# List all customers in terminal
pnpm db:list

# Clear all customers (triggers DELETE events)
pnpm db:clear
```

## 📊 Database Schema

**Table:** `customer_addresses`

| Column         | Type         | Description                  |
| -------------- | ------------ | ---------------------------- |
| `id`           | SERIAL       | Primary key (auto-increment) |
| `first_name`   | VARCHAR(100) | Customer first name          |
| `last_name`    | VARCHAR(100) | Customer last name           |
| `email`        | VARCHAR(255) | Email address                |
| `res_address`  | TEXT         | Residential address          |
| `work_address` | TEXT         | Work address                 |
| `country`      | VARCHAR(100) | Country                      |
| `state`        | VARCHAR(100) | State/Province               |
| `phone_1`      | VARCHAR(20)  | Primary phone                |
| `phone_2`      | VARCHAR(20)  | Secondary phone              |

## 🛠️ Available Commands

### Moose (Main Application)

| Command               | Description               |
| --------------------- | ------------------------- |
| `pnpm dev`            | Start Moose dev server    |
| `pnpm build`          | Build for production      |
| `pnpm dev:pull:kafka` | Pull Kafka topics for CDC |

### Database Management

| Command            | Description                      |
| ------------------ | -------------------------------- |
| `pnpm db:studio`   | Open Drizzle Studio (visual GUI) |
| `pnpm db:push`     | Push schema changes to database  |
| `pnpm db:generate` | Generate migration files         |

### Data Operations

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm db:seed [n]` | Create n random customers (default 10) |
| `pnpm db:list`     | List all customers in terminal         |
| `pnpm db:clear`    | Delete all customers                   |

## 🔍 Monitoring CDC Events

### View Events in Kafka

```bash
# List topics
docker exec debezium-cdc-redpanda-1 rpk topic list

# Consume CDC events
docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --num 10

# Consume from beginning
docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --offset start
```

### Check Moose Logs

The Moose dev server will log all incoming CDC events:

```
[cdcCustomerAddresses] {"op":"c","after":{...},"ts_ms":...}
```

### Query ClickHouse

```bash
# Connect to ClickHouse
docker exec -it <clickhouse-container> clickhouse-client

# Query processed data
SELECT * FROM customer_addresses ORDER BY ts_ms DESC LIMIT 10;
```

## 📁 Project Structure

```
debezium-cdc/
├── app/
│   ├── db/
│   │   ├── schema.ts          # Drizzle schema definition
│   │   └── index.ts           # Database connection
│   ├── cdc-topics/
│   │   └── externalTopics.ts  # Kafka topic definitions
│   ├── index.ts               # Moose CDC processing logic
│   └── seed.ts                # Data seeding CLI
├── drizzle.config.ts          # Drizzle Kit configuration
├── docker-compose.yml         # Infrastructure services
├── setup-cdc.sh               # CDC connector setup script
├── package.json               # Dependencies & scripts
└── tsconfig.json              # TypeScript configuration
```

## 🎨 Using Drizzle Studio (Visual Database GUI)

**Drizzle Studio** is your visual interface for testing the CDC pipeline. Every change you make generates a CDC event that flows through the entire system!

### Access

```bash
pnpm db:studio
# Opens at http://local.drizzle.studio/
```

### How to Use Drizzle Studio

1. **Browse Data**

   - Click `customer_addresses` table to see all records
   - Sort, filter, and paginate through data

2. **Create Records** → Triggers CDC INSERT Events

   - Click "Add Row" button
   - Fill in customer details
   - Save → **Check Moose terminal for INSERT event!**

3. **Edit Records** → Triggers CDC UPDATE Events

   - Click any cell to edit inline
   - Change a value (e.g., state from "California" to "Texas")
   - Save → **Check Moose terminal for UPDATE event!**

4. **Delete Records** → Triggers CDC DELETE Events
   - Select rows
   - Click delete
   - **Check Moose terminal for DELETE event!**

### What You'll See

**In Drizzle Studio:** Your database changes happen instantly

**In Moose Terminal:** CDC events appear within seconds

```
[cdcCustomerAddresses] {"op":"c","after":{...}}  ← INSERT
[cdcCustomerAddresses] {"op":"u","before":{...},"after":{...}}  ← UPDATE
[cdcCustomerAddresses] {"op":"d","before":{...}}  ← DELETE
```

**In Kafka/Redpanda:** Events are stored with JSON Schema validation

```bash
docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --num 1
```

**In Schema Registry:** Schemas are automatically registered

```bash
curl http://localhost:8081/apis/registry/v2/search/artifacts
```

## 🧪 Testing the CDC Pipeline

### 1. Create a Customer

```bash
pnpm seed 1

**Expected Output:**

```

🌱 Seeding database with 1 random customers...
✅ Created customer 1/1: John Smith (ID: 1)
🔄 CDC events generated for 1 INSERT operations via Debezium

```

### 2. Monitor the Event Flow

**In Moose logs:**

```

[cdcCustomerAddresses] {"op":"c","after":{"id":1,"first_name":"John",...}}

````

**In Kafka:**

```bash
docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --num 1
````

### 3. Edit Data in Drizzle Studio

1. Open http://localhost:4983
2. Click on `customer_addresses` table
3. Edit a field (e.g., change state to "Texas")
4. See UPDATE event in Moose logs

### 4. Delete a Customer

```bash
pnpm clear
```

Watch DELETE events flow through the pipeline.

## 📡 Services & Ports

| Service             | URL/Port              | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| **Moose Dev**       | http://localhost:4000 | Moose application (check terminal!) |
| **Drizzle Studio**  | http://localhost:4983 | Visual database GUI                 |
| **PostgreSQL**      | localhost:5433        | Source database                     |
| **Kafka Connect**   | http://localhost:8084 | Debezium connector API              |
| **Schema Registry** | http://localhost:8081 | Apicurio Registry (JSON Schema)     |
| **Redpanda**        | localhost:19092       | Kafka-compatible message broker     |
| **ClickHouse**      | localhost:18123       | Analytics database                  |

## 🔧 Configuration

### Database Connection

Environment variables (or defaults in `app/db/index.ts`):

```bash
DB_HOST=localhost
DB_PORT=5433
DB_NAME=shop
DB_USER=postgres
DB_PASSWORD=postgres
```

### Debezium Connector

Configuration in `postgres-connector.json`:

- **Connector name**: `postgres-connector`
- **Topic prefix**: `pg-cdc`
- **Table**: `public.customer_addresses`
- **Kafka topic**: `pg-cdc.public.customer_addresses`
- **Snapshot mode**: `initial` (takes initial snapshot + streams changes)
- **Serialization**: JSON Schema with Apicurio Registry

### Schema Registry

**Apicurio Registry** automatically registers JSON Schemas:

- Key schema: `pg-cdc.public.customer_addresses-key`
- Value schema: `pg-cdc.public.customer_addresses-value`

Each CDC event contains `schemaId` for validation.

### Moose Processing

Logic in `app/index.ts`:

- Consumes CDC events from Kafka topic
- Deserializes JSON Schema messages
- Transforms events (handles INSERT, UPDATE, DELETE)
- Writes to ClickHouse for analytics

## 🐛 Troubleshooting

### "Permission denied" on setup-cdc.sh

```bash
chmod +x setup-cdc.sh
```

### Moose won't start / Docker services not starting

```bash
# Stop everything cleanly
docker stop $(docker ps -aq)

# Restart Moose (this will recreate all CDC services)
pnpm dev
```

### CDC events not appearing in Moose terminal

1. **Check connector status:**

   ```bash
   curl http://localhost:8084/connectors/postgres-connector/status
   ```

   Should show `"state": "RUNNING"` for both connector and tasks.

2. **Check if events are in Kafka:**

   ```bash
   docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --num 1
   ```

3. **Verify Moose external topic config:**

   ```bash
   cat app/cdc-topics/externalTopics.ts
   ```

4. **Restart connector if needed:**
   ```bash
   curl -X DELETE http://localhost:8084/connectors/postgres-connector
   ./setup-cdc.sh
   ```

## 📚 Resources

- [Debezium Documentation](https://debezium.io/)
- [Moose Documentation](https://docs.moosejs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Redpanda Documentation](https://docs.redpanda.com/)
