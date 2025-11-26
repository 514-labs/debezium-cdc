/**
 * Connector configuration generation
 * Mirrors debezium-connector.ts from production
 */

import { Config } from "../../../config/config";

export interface ConnectorConfig {
  name: string;
  config: Record<string, string>;
}

export function generateConnectorConfig(config: Config): ConnectorConfig {
  // When Kafka Connect runs in Docker, it needs special handling:
  // 1. If DB_HOST_CONTAINER is set, use it (for Docker service name like "postgres")
  // 2. If DB_HOST is "localhost", replace with "host.docker.internal" (Mac/Windows Docker)
  // 3. Otherwise use DB_HOST as-is (for external databases)
  let dbHost = config.get("DB_HOST_CONTAINER");
  if (!dbHost) {
    dbHost = config.require("DB_HOST");
    // Replace localhost with host.docker.internal for container-to-host access
    if (dbHost === "localhost" || dbHost === "127.0.0.1") {
      dbHost = "host.docker.internal";
    }
  }

  // Use DB_PORT_CONTAINER if set, otherwise use DB_PORT
  // Note: When using host.docker.internal, use the mapped port (5433)
  // When using Docker service name, use internal port (5432)
  const dbPort =
    config.getNumber("DB_PORT_CONTAINER") || config.getNumber("DB_PORT")!;

  return {
    name: config.require("CDC_CONNECTOR_NAME"),
    config: {
      // Connector class
      "connector.class": "io.debezium.connector.postgresql.PostgresConnector",

      // Database connection
      "database.hostname": dbHost,
      "database.port": dbPort.toString(),
      "database.user": config.require("DB_USER"),
      "database.password": config.require("DB_PASSWORD"),
      "database.dbname": config.require("DB_NAME"),

      // Topic configuration
      "topic.prefix": config.require("CDC_TOPIC_PREFIX"),
      "table.include.list": config.require("CDC_TABLE_INCLUDE_LIST"),

      // PostgreSQL logical replication
      "plugin.name": config.require("CDC_PLUGIN_NAME"),
      "slot.name": config.require("CDC_SLOT_NAME"),
      "publication.name": config.require("CDC_PUBLICATION_NAME"),

      // Snapshot mode
      "snapshot.mode": config.require("CDC_SNAPSHOT_MODE"),

      // Message handling
      "tombstones.on.delete": "false",
      "decimal.handling.mode": "string",
      "skipped.operations": "t",
      "include.schema.changes": "false",

      // JSON converters (matching production)
      "key.converter": "org.apache.kafka.connect.json.JsonConverter",
      "value.converter": "org.apache.kafka.connect.json.JsonConverter",
      "key.converter.schemas.enable": "false",
      "value.converter.schemas.enable": "false",

      // Producer settings (matching production)
      "producer.max.request.size": "10485760",
      "producer.buffer.memory": "67108864",
    },
  };
}
