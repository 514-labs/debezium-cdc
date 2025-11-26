# CDC Pipeline Configuration Analysis

## Overview

This document reconciles the Debezium connector configuration, Kafka topics, and the cdc-pipeline code structure.

## 1. Debezium Connector Configuration

**Source:** `debezium/src/resources/debezium-connector.ts`

### Key Configuration Values:

- **Topic Prefix:** `CDC_TOPIC_PREFIX` (default: `pg-cdc`)
- **Table Include List:** `CDC_TABLE_INCLUDE_LIST` (default: `public.*`)
- **Connector Name:** `CDC_CONNECTOR_NAME` (default: `postgres-connector`)

### Topic Naming Pattern:

Debezium creates topics using the pattern:

```
<topic.prefix>.<schema>.<table>
```

**Example:**

- `pg-cdc.public.customer_addresses`
- `pg-cdc.public.another_table`

## 2. Actual Kafka Topics (from Redpanda)

### CDC Source Topics (from Debezium):

- ✅ `pg-cdc.public.customer_addresses`
- ✅ `pg-cdc.public.another_table`

### Intermediate Stream Topics (from Moose transforms):

- ✅ `ProcessedCustomerAddresses`
- ✅ `ProcessedAnotherTable`

### Kafka Connect Internal Topics:

- `cdc-connect-local-configs`
- `cdc-connect-local-offsets`
- `cdc-connect-local-status`

## 3. CDC Pipeline Structure

### Flow Diagram:

```
PostgreSQL Database
    ↓ (Debezium CDC)
pg-cdc.public.customer_addresses (Kafka Topic)
    ↓ (Transform: customer-addresses.ts)
ProcessedCustomerAddresses (Intermediate Stream)
    ↓ (Destination: sink-topics.ts → olap-tables.ts)
customer_addresses (ClickHouse OLAP Table)
```

### File Structure:

#### 1-sources/ (CDC Source Topics)

- **externalTopics.ts** (AUTO-GENERATED)
  - `PgCdcPublicAnotherTableStream` → `pg-cdc.public.another_table`
  - `PgCdcPublicCustomerAddressesStream` → `pg-cdc.public.customer_addresses`
- **typed-topics.ts** (Type-safe wrappers)
  - `cdcAnotherTable` → Typed as `GenericCDCEvent<AnotherTable>`
  - `cdcCustomerAddresses` → Typed as `GenericCDCEvent<CustomerAddress>`

#### 2-transforms/ (Transform Logic)

- **customer-addresses.ts**

  - Reads from: `cdcCustomerAddresses`
  - Writes to: `processedCustomerAddresses`
  - Transform: `handleCDCPayload<CustomerAddress>()`

- **another-table.ts**

  - Reads from: `cdcAnotherTable`
  - Writes to: `processedAnotherTable`
  - Transform: `handleCDCPayload<AnotherTable>()`

- **payload-handler.ts** (Generic handler)
  - Handles CDC operations: `c` (create), `u` (update), `d` (delete), `r` (read/snapshot)
  - Adds CDC metadata: `_is_deleted`, `ts_ms`, `lsn`

#### 3-destinations/ (Final Destinations)

- **sink-topics.ts** (Intermediate streams)

  - `processedCustomerAddresses` → Stream → `olapCustomerAddresses`
  - `processedAnotherTable` → Stream → `olapAnotherTable`

- **olap-tables.ts** (ClickHouse tables)
  - `olapCustomerAddresses` → ClickHouse table `customer_addresses`
  - `olapAnotherTable` → ClickHouse table `another_table`
  - Engine: `ReplacingMergeTree` (deduplicates by `lsn`, respects `_is_deleted`)

## 4. CDC Event Format

### Actual Event Structure (from Kafka):

```json
{
  "before": null,
  "after": {
    "id": 1,
    "first_name": "Geniel",
    "last_name": "Nycz",
    "email": "roundtable_lula@yahoo.co.uk",
    "res_address": "557 Binstock Tunnel",
    "work_address": "494 Burrier Crossing",
    "country": "Ghana",
    "state": "New Mexico",
    "phone_1": "45 52583449",
    "phone_2": "420 603268872"
  },
  "source": {
    "version": "3.3.1.Final",
    "connector": "postgresql",
    "name": "pg-cdc",
    "ts_ms": 1764175314629,
    "snapshot": "first_in_data_collection",
    "db": "test-db",
    "schema": "public",
    "table": "customer_addresses",
    "txId": 760,
    "lsn": 25087200
  },
  "op": "r", // r=read/snapshot, c=create, u=update, d=delete
  "ts_ms": 1764175314992
}
```

### TypeScript Type (models.ts):

```typescript
GenericCDCEvent<T> = {
  schemaId: string;
  payload: {
    before: T | null;
    after: T | null;
    source: { ... };
    op: "c" | "u" | "d" | "r";
    ts_ms: number;
  };
}
```

## 5. Reconciliation Status

### ✅ Aligned:

1. **Topic Names:** Debezium creates `pg-cdc.public.*` topics matching the pipeline expectations
2. **Table Names:** `customer_addresses` and `another_table` match between PostgreSQL and pipeline
3. **Event Format:** GenericCDCEvent type matches actual Debezium payload structure
4. **Transform Flow:** Transforms correctly process CDC events and route to intermediate streams

### ⚠️ Potential Issues:

1. **Topic Prefix Hardcoding:**

   - Pipeline expects: `pg-cdc.public.*`
   - Configurable via: `CDC_TOPIC_PREFIX` env var
   - **Status:** ✅ Aligned (both use `pg-cdc`)

2. **Schema Name:**

   - Debezium uses: `public` schema
   - Pipeline expects: `public` schema
   - **Status:** ✅ Aligned

3. **Table Include List:**

   - Debezium config: `public.*` (all tables)
   - Pipeline handles: `customer_addresses`, `another_table`
   - **Status:** ✅ Aligned (pipeline only processes tables it knows about)

4. **Event Structure:**
   - Debezium sends: Raw JSON with `before`, `after`, `source`, `op`
   - Pipeline expects: `GenericCDCEvent<T>` wrapper
   - **Note:** Moose may wrap the raw payload, need to verify

## 6. Configuration Dependencies

### Required Environment Variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=test-db
DB_USER=postgres
DB_PASSWORD=postgres

# Debezium Connector
CDC_CONNECTOR_NAME=postgres-connector
CDC_TOPIC_PREFIX=pg-cdc
CDC_TABLE_INCLUDE_LIST=public.*
CDC_PLUGIN_NAME=pgoutput
CDC_SLOT_NAME=debezium_slot
CDC_PUBLICATION_NAME=debezium_publication
CDC_SNAPSHOT_MODE=initial

# Kafka Connect
KAFKA_CONNECT_PORT=8084
```

### Topic Naming Convention:

- **Debezium Topics:** `<CDC_TOPIC_PREFIX>.<schema>.<table>`
- **Intermediate Streams:** `Processed<TableName>` (PascalCase)
- **ClickHouse Tables:** `<table_name>` (snake_case)

## 7. Type Mismatches Found

### ⚠️ Issue 1: `schemaId` Field

- **Type Definition:** `GenericCDCEvent<T>` expects `schemaId: string` at top level
- **Actual Event:** No `schemaId` field in raw Debezium payload
- **Status:** ⚠️ **MISMATCH** - Moose may wrap messages, or type definition is incorrect

### ⚠️ Issue 2: `snapshot` Field Type

- **Type Definition:** `source.snapshot: boolean`
- **Actual Event:** `source.snapshot: "first_in_data_collection"` (string)
- **Status:** ⚠️ **MISMATCH** - Should be `string | boolean` or just `string`

### ✅ Matches:

- `source.sequence: string[]` ✅
- `source.lsn: number` ✅
- `op: "c" | "u" | "d" | "r"` ✅
- `before` and `after` structure ✅

## 8. Recommendations

### Immediate Fixes:

1. **Fix Type Definition:**

   ```typescript
   // In models.ts, update GenericCDCEvent:
   export type GenericCDCEvent<T> = {
     schemaId?: string; // Optional, may be added by Moose
     payload: {
       // ... existing fields
       source: {
         // ...
         snapshot: string | boolean; // Fix: Debezium sends string
         // ...
       };
     };
   };
   ```

2. **Verify Moose Wrapping:**

   - Check if Moose adds `schemaId` wrapper when consuming from Kafka
   - If not, remove `schemaId` from type definition
   - If yes, document this behavior

3. **Add Validation:**
   - Validate `op` field is one of expected values
   - Handle missing `before`/`after` gracefully
   - Log warnings for unexpected event structures

### Documentation:

1. **Topic Naming Convention:**

   - Document that Debezium creates: `<prefix>.<schema>.<table>`
   - Document that intermediate streams use PascalCase: `Processed<TableName>`
   - Document that ClickHouse tables use snake_case: `<table_name>`

2. **Event Flow:**

   - Document the complete flow from PostgreSQL → Debezium → Kafka → Transform → ClickHouse
   - Explain how `_is_deleted`, `ts_ms`, and `lsn` are added by transforms

3. **Configuration:**
   - Document all required environment variables
   - Explain the relationship between `CDC_TOPIC_PREFIX` and topic names
   - Document how `CDC_TABLE_INCLUDE_LIST` affects which tables are monitored
