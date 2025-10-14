# Debezium CDC with Moose Integration

A complete **Change Data Capture (CDC)** demo using Debezium, PostgreSQL, and Moose for real-time data streaming and analytics.

<a href="https://docs.fiveonefour.com/moose"><img src="https://raw.githubusercontent.com/514-labs/moose/main/logo-m-light.png" alt="moose logo" height="100px"></a>

[![NPM Version](https://img.shields.io/npm/v/%40514labs%2Fmoose-cli?logo=npm)](https://www.npmjs.com/package/@514labs/moose-cli?activeTab=readme)
[![Moose Community](https://img.shields.io/badge/slack-moose_community-purple.svg?logo=slack)](https://join.slack.com/t/moose-community/shared_invite/zt-2fjh5n3wz-cnOmM9Xe9DYAgQrNu8xKxg)

## 🎯 What This Demo Does

This project demonstrates how to:

- **Capture database changes** in real-time using Debezium
- **Stream changes** through Kafka to a Moose application
- **Process and analyze** streaming data with ClickHouse
- **Build APIs** that trigger CDC events automatically

## 🏗️ Architecture

```
PostgreSQL → Debezium → Kafka Connect → Redpanda → Moose Kafka Consumer → ClickHouse
     ↑                                                              ↓
  REST API                                                    Analytics API
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for CDC services)
- **Node.js 16+** (for Moose and API)
- **Moose CLI**: `npm install -g @514labs/moose-cli`

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd debezium-cdc
npm install
```

### 2. Start Moose Infrastructure

```bash
# Start Moose dev server (includes Redpanda, ClickHouse, etc.)
moose dev
```

**Keep this terminal open** - Moose dev server must stay running.

### 3. Setup CDC Services

In a **new terminal**:

```bash
# Make setup script executable and run it
chmod +x setup-cdc.sh
./setup-cdc.sh
```

This script will:

- ✅ Start PostgreSQL with CDC configuration
- ✅ Start Kafka Connect with Debezium
- ✅ Create sample data
- ✅ Configure the Debezium connector
- ✅ Verify everything is working

### 4. Start the API Server

In a **third terminal**:

```bash
cd api
npm install
npm start
```

### 5. Test the Integration

**View API Documentation:**

```bash
open http://localhost:3001/api-docs
```

**Create a customer (triggers CDC):**

```bash
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "country": "USA",
    "state": "California"
  }'
```

**Check CDC events in Moose:**

```bash
# View external topic configuration
cat app/external-topics/externalTopics.ts

# Check Kafka topic
docker exec debezium-cdc-redpanda-1 rpk topic consume shop-server.public.customer_addresses --num 1
```

## 📊 Services Overview

| Service           | URL                   | Description                     |
| ----------------- | --------------------- | ------------------------------- |
| **Moose Dev**     | http://localhost:4000 | Main Moose application          |
| **API Server**    | http://localhost:3001 | REST API with Swagger docs      |
| **Kafka Connect** | http://localhost:8084 | Debezium connector management   |
| **PostgreSQL**    | localhost:5433        | CDC-enabled database            |
| **ClickHouse**    | localhost:18123       | Analytics database              |
| **Redpanda**      | localhost:19092       | Kafka-compatible message broker |

## 🔧 Key Files

- `setup-cdc.sh` - Automated CDC setup script
- `docker-compose.dev.override.yaml` - CDC services configuration
- `app/external-topics/externalTopics.ts` - Moose external topic configuration
- `api/` - REST API server with CDC integration

## 🧪 Testing CDC

### 1. Create Data via API

```bash
curl -X POST http://localhost:3001/customers -H "Content-Type: application/json" -d '{"firstName": "Alice", "lastName": "Smith", "email": "alice@example.com", "country": "USA", "state": "Texas"}'
```

### 2. Update Data via API

```bash
curl -X PUT http://localhost:3001/customers/1 -H "Content-Type: application/json" -d '{"state": "Nevada"}'
```

### 3. Create Random Test Data

```bash
curl -X POST http://localhost:3001/bulk-random/5
```

### 4. Monitor Changes

**Check database:**

```bash
docker exec -i cdc-postgres psql -U postgres -d shop -c "SELECT * FROM customer_addresses ORDER BY id;"
```

**Check CDC events:**

```bash
docker exec debezium-cdc-redpanda-1 rpk topic consume shop-server.public.customer_addresses --num 5
```

**Check connector status:**

```bash
curl http://localhost:8084/connectors/shop-server-connector/status
```

## 🛠️ Development Workflow

### Starting Everything

```bash
# Terminal 1: Start Moose
moose dev

# Terminal 2: Setup CDC (one-time)
./setup-cdc.sh

# Terminal 3: Start API
cd api && npm start
```

### Stopping Everything

```bash
# Stop API: Ctrl+C in terminal 3
# Stop Moose: Ctrl+C in terminal 1 (this stops CDC services too)
```

### Making Changes

**Moose App Changes:**

- Edit files in `app/`
- Moose dev server auto-reloads

**API Changes:**

- Edit files in `api/`
- Restart with `npm run dev` for auto-reload

**CDC Configuration Changes:**

- Edit `docker-compose.dev.override.yaml`
- Re-run `./setup-cdc.sh`

## 🚨 Troubleshooting

### "Permission denied" on setup-cdc.sh

```bash
chmod +x setup-cdc.sh
```

### Kafka Connect fails to start

The setup script automatically fixes common issues, but if you see errors:

1. **Check Moose is running:**

   ```bash
   curl http://localhost:19092  # Should connect
   ```

2. **Check topic configurations:**

   ```bash
   docker exec debezium-cdc-redpanda-1 rpk topic list
   ```

3. **Restart CDC services:**
   ```bash
   docker restart kafka-connect-cdc
   ```

### API can't connect to database

```bash
# Check PostgreSQL is running
docker ps | grep cdc-postgres

# Check database connectivity
docker exec -i cdc-postgres psql -U postgres -d shop -c "SELECT 1;"
```

### CDC events not appearing

```bash
# Check connector status
curl http://localhost:8084/connectors/shop-server-connector/status

# Check if connector is running
curl http://localhost:8084/connectors

# Restart connector if needed
curl -X POST http://localhost:8084/connectors/shop-server-connector/restart
```

### "No space left on device" in ClickHouse

This means your Docker environment is out of disk space:

- Clean up unused Docker images: `docker system prune -a`
- Increase Docker Desktop disk allocation
- Check available space: `df -h`

## 📚 Learn More

- **[Moose Documentation](https://docs.fiveonefour.com/moose)** - Learn about Moose framework
- **[Debezium Documentation](https://debezium.io/documentation/)** - CDC connector details
- **[API Documentation](./api/README.md)** - REST API details

## 🤝 Community

- **[Moose Slack](https://join.slack.com/t/moose-community/shared_invite/zt-2fjh5n3wz-cnOmM9Xe9DYAgQrNu8xKxg)** - Join the community
- **[GitHub](https://github.com/514-labs/moose)** - Moose source code

---

## 💡 What's Happening Under the Hood

1. **Moose dev** starts ClickHouse, Redpanda, and other core services
2. **setup-cdc.sh** adds PostgreSQL and Kafka Connect to the mix
3. **Debezium** monitors PostgreSQL's Write-Ahead Log (WAL) for changes
4. **Changes** are streamed to Redpanda as structured JSON events
5. **Moose** consumes these events via external topics configuration
6. **ClickHouse** stores the data for analytics queries
7. **API** provides an easy way to create test data and trigger CDC events

This creates a complete real-time data pipeline from operational database changes to analytics-ready data!
