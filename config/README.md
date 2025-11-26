# Shared Configuration

This directory contains shared configuration utilities used across the project.

## `config.ts` - Config Class

A configuration class that mimics the Pulumi Config API, reading from environment variables instead.

### Features

- **Pulumi-compatible API**: Same methods as `pulumi.Config`
- **CamelCase to UPPER_SNAKE_CASE**: Automatic conversion (e.g., `kafkaBootstrapServers` → `KAFKA_BOOTSTRAP_SERVERS`)
- **Namespace prefix support**: Optional prefix for scoped configuration
- **Type-safe**: Full TypeScript support
- **Automatic dotenv loading**: Loads `.env` file automatically

### Usage

```typescript
import { Config } from "../config/config";

// Basic usage (no prefix)
const config = new Config();
const dbHost = config.require("DB_HOST"); // Reads DB_HOST
const dbPort = config.getNumber("DB_PORT") || 5432; // Reads DB_PORT

// With namespace prefix
const debeziumConfig = new Config("DEBEZIUM");
const kafkaServers = debeziumConfig.require("KAFKA_BOOTSTRAP_SERVERS");
// Reads DEBEZIUM_KAFKA_BOOTSTRAP_SERVERS

// Optional values
const namespace = config.get("NAMESPACE") || "default";
const replicas = config.getNumber("REPLICAS") || 3;
const enabled = config.getBoolean("ENABLED") || false;
```

### API Methods

- `get(key: string): string | undefined` - Get optional string value
- `require(key: string): string` - Get required string value (throws if missing)
- `requireSecret(key: string): string` - Get required secret value
- `getNumber(key: string): number | undefined` - Get optional number value
- `getBoolean(key: string): boolean | undefined` - Get optional boolean value
- `getObject<T>(key: string): T | undefined` - Get optional JSON object value

### Environment Variable Usage

Keys are used exactly as provided:

- `"DB_HOST"` → reads `DB_HOST` from environment
- `"KAFKA_BOOTSTRAP_SERVERS"` → reads `KAFKA_BOOTSTRAP_SERVERS` from environment
- `"CDC_CONNECTOR_NAME"` → reads `CDC_CONNECTOR_NAME` from environment

With namespace `"DEBEZIUM"`:

- `"KAFKA_BOOTSTRAP_SERVERS"` → reads `DEBEZIUM_KAFKA_BOOTSTRAP_SERVERS` from environment

### Examples

```typescript
// Example 1: Basic configuration
const config = new Config();
const host = config.require("DB_HOST");
const port = config.getNumber("DB_PORT") || 5432;

// Example 2: Namespaced configuration
const debeziumConfig = new Config("DEBEZIUM");
const kafkaBootstrapServers = debeziumConfig.require("KAFKA_BOOTSTRAP_SERVERS");
const kafkaPassword = debeziumConfig.requireSecret("KAFKA_PASSWORD");

// Example 3: Optional values with defaults
const config = new Config();
const namespace = config.get("NAMESPACE") || "default";
const replicas = config.getNumber("REPLICAS") || 3;
const enableTls = config.getBoolean("ENABLE_TLS") || false;
```
