# Debezium CDC Setup

Debezium connector setup and management for Change Data Capture (CDC).

## Structure

```
debezium/
├── src/
│   ├── index.ts                    # Main orchestration script
│   ├── utils.ts                    # Utility functions
│   └── resources/
│       ├── config.ts               # Configuration loading
│       ├── debezium-connector.ts   # Connector config generation
│       └── kafka-connect.ts       # Kafka Connect API operations
```

## Usage

```bash
# Setup Debezium connector
pnpm cdc:setup

# Dry run (show config only)
pnpm cdc:setup:dry-run
```

## Features

- Auto-detects local PostgreSQL container
- Configures connector for Docker network or external database
- Creates/updates Debezium connector via Kafka Connect REST API
- Handles database setup if local container detected

