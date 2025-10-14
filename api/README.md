# CDC PostgreSQL API

A RESTful API server that demonstrates **Change Data Capture (CDC)** integration with Debezium, PostgreSQL, and Moose. Every API operation automatically triggers CDC events that flow through your data pipeline.

## 🎯 Purpose

This API serves as a **data generator** for testing CDC functionality. It provides:

- ✅ **CRUD operations** on customer data
- ✅ **Automatic CDC event generation** for every database change
- ✅ **Interactive documentation** via Swagger UI
- ✅ **Bulk test data generation** for realistic scenarios

## 🚀 Quick Start

### Prerequisites

**Complete the main project setup first:**

1. Start Moose dev server: `moose dev`
2. Run CDC setup: `./setup-cdc.sh`
3. Verify services are running

### Start the API Server

```bash
cd api
npm install
npm start
```

### Access Interactive Documentation

**Open in browser:** http://localhost:3001/api-docs

The Swagger UI provides the best way to explore and test the API!

## 📊 CDC Integration Overview

```
API Request → PostgreSQL → Debezium → Kafka Connect → Redpanda → Moose App
     ↓              ↓           ↓            ↓           ↓          ↓
 HTTP Response  DB Change   CDC Event   Kafka Topic  Stream   ClickHouse
```

Every API operation creates a **CDC event** in the `shop-server.public.customer_addresses` topic.

## 🔧 API Endpoints

### Core CRUD Operations

| Method   | Endpoint         | Description         | CDC Event |
| -------- | ---------------- | ------------------- | --------- |
| `GET`    | `/customers`     | List all customers  | None      |
| `GET`    | `/customers/:id` | Get customer by ID  | None      |
| `POST`   | `/customers`     | Create new customer | `INSERT`  |
| `PUT`    | `/customers/:id` | Update customer     | `UPDATE`  |
| `DELETE` | `/customers/:id` | Delete customer     | `DELETE`  |

### Test Data Generation

| Method | Endpoint              | Description                | CDC Events           |
| ------ | --------------------- | -------------------------- | -------------------- |
| `POST` | `/random-operation`   | Random CREATE or UPDATE    | `INSERT` or `UPDATE` |
| `POST` | `/bulk-random/:count` | Multiple random operations | Multiple events      |

### Utility Endpoints

| Method | Endpoint    | Description               |
| ------ | ----------- | ------------------------- |
| `GET`  | `/`         | API information           |
| `GET`  | `/health`   | Health check              |
| `GET`  | `/api-docs` | Interactive documentation |

## 🧪 Testing CDC Events

### 1. Create a Customer

```bash
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alice",
    "lastName": "Johnson",
    "email": "alice@example.com",
    "resAddress": "123 Oak St",
    "country": "USA",
    "state": "California"
  }'
```

**Expected CDC Event:**

```json
{
  "op": "c",
  "after": {
    "id": 6,
    "first_name": "Alice",
    "last_name": "Johnson",
    "email": "alice@example.com",
    "res_address": "123 Oak St",
    "country": "USA",
    "state": "California"
  },
  "before": null
}
```

### 2. Update a Customer

```bash
curl -X PUT http://localhost:3001/customers/6 \
  -H "Content-Type: application/json" \
  -d '{
    "state": "New York",
    "resAddress": "456 Broadway"
  }'
```

**Expected CDC Event:**

```json
{
  "op": "u",
  "before": {
    "id": 6,
    "state": "California",
    "res_address": "123 Oak St"
  },
  "after": {
    "id": 6,
    "state": "New York",
    "res_address": "456 Broadway"
  }
}
```

### 3. Generate Test Data

```bash
# Single random operation
curl -X POST http://localhost:3001/random-operation

# Bulk operations (great for testing)
curl -X POST http://localhost:3001/bulk-random/10
```

### 4. Monitor CDC Events

```bash
# View recent CDC events
docker exec debezium-cdc-redpanda-1 rpk topic consume shop-server.public.customer_addresses --num 5

# Check database state
docker exec -i cdc-postgres psql -U postgres -d shop -c "SELECT * FROM customer_addresses ORDER BY id DESC LIMIT 5;"
```

## 🎲 Random Data Features

### Random Customer Creation

Send `{"random": true}` to generate realistic fake data:

```bash
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -d '{"random": true}'
```

### Random Customer Updates

```bash
curl -X PUT http://localhost:3001/customers/1 \
  -H "Content-Type: application/json" \
  -d '{"random": true}'
```

### Bulk Random Operations

Perfect for load testing your CDC pipeline:

```bash
# Generate 20 random operations (mix of creates/updates)
curl -X POST http://localhost:3001/bulk-random/20
```

## 📡 CDC Event Details

### Event Structure

Every CDC event includes:

```json
{
  "before": {
    /* Previous state (null for INSERT) */
  },
  "after": {
    /* New state (null for DELETE) */
  },
  "source": {
    "version": "2.3.4.Final",
    "connector": "postgresql",
    "name": "shop-server",
    "ts_ms": 1760419431173,
    "db": "shop",
    "schema": "public",
    "table": "customer_addresses"
  },
  "op": "c|u|d" /* CREATE, UPDATE, DELETE */,
  "ts_ms": 1760419431241
}
```

### Event Types

- **`op: "c"`** - CREATE (INSERT)
- **`op: "u"`** - UPDATE
- **`op: "d"`** - DELETE
- **`op: "r"`** - READ (initial snapshot)

## 🗃️ Database Schema

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

## 🔍 Monitoring & Debugging

### Check Connector Status

```bash
curl http://localhost:8084/connectors/shop-server-connector/status
```

**Healthy Response:**

```json
{
  "name": "shop-server-connector",
  "connector": { "state": "RUNNING" },
  "tasks": [{ "state": "RUNNING" }]
}
```

### View Database Directly

```bash
# Connect to PostgreSQL
docker exec -it cdc-postgres psql -U postgres -d shop

# View all customers
SELECT * FROM customer_addresses ORDER BY id;

# View recent changes
SELECT * FROM customer_addresses WHERE id > 5;
```

### Debug CDC Events

```bash
# List all Kafka topics
docker exec debezium-cdc-redpanda-1 rpk topic list

# Consume from beginning
docker exec debezium-cdc-redpanda-1 rpk topic consume shop-server.public.customer_addresses --offset start

# Check topic details
docker exec debezium-cdc-redpanda-1 rpk topic describe shop-server.public.customer_addresses
```

## 🚨 Error Handling

### API Error Responses

```json
{
  "success": false,
  "error": "Customer not found",
  "message": "The requested customer ID does not exist in the database"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid data)
- `404` - Not Found
- `500` - Server Error

### Troubleshooting

**API won't start:**

```bash
# Check if port 3001 is in use
lsof -i :3001

# Check PostgreSQL connection
docker exec -i cdc-postgres psql -U postgres -d shop -c "SELECT 1;"
```

**CDC events not appearing:**

```bash
# Check connector status
curl http://localhost:8084/connectors/shop-server-connector/status

# Restart connector if needed
curl -X POST http://localhost:8084/connectors/shop-server-connector/restart
```

## 🛠️ Development

### Environment Variables

The API uses these default connections:

```bash
DB_HOST=localhost
DB_PORT=5433
DB_NAME=shop
DB_USER=postgres
DB_PASSWORD=postgres
```

### Running in Development Mode

```bash
npm run dev  # Auto-reload on changes
```

### API Testing Tools

**Best Option - Swagger UI:**

- http://localhost:3001/api-docs

**Command Line:**

```bash
# Using curl (examples above)
# Using HTTPie
http POST localhost:3001/customers firstName=John lastName=Doe email=john@example.com country=USA state=California
```

**GUI Tools:**

- Import OpenAPI spec from `/api-docs.json` into Postman/Insomnia

## 📖 OpenAPI Specification

- **Interactive UI:** http://localhost:3001/api-docs
- **JSON Format:** http://localhost:3001/api-docs.json
- **YAML File:** `./openapi.yaml` (if exists)

## 🔗 Integration with Moose

This API is designed to work seamlessly with the Moose CDC demo:

1. **API creates data** → PostgreSQL
2. **Debezium captures changes** → Kafka Connect
3. **Events flow to Redpanda** → Moose external topics
4. **Moose processes events** → ClickHouse analytics
5. **Query results** in Moose dashboards/APIs

**View the external topic configuration:**

```bash
cat ../app/external-topics/externalTopics.ts
```

---

**💡 Pro Tip:** Use the Swagger UI at `/api-docs` for the best API exploration experience. It shows real-time examples and lets you test everything directly in your browser!
