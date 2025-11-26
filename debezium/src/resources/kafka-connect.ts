/**
 * Kafka Connect REST API operations
 * Mirrors debezium-connector-job.ts logic from production
 */

import { ConnectorConfig } from "./debezium-connector";
import { sleep } from "../utils";

export async function waitForKafkaConnect(
  url: string,
  maxAttempts = 30
): Promise<void> {
  console.log("⏳ Waiting for Kafka Connect to be ready...");

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/`);
      if (response.ok) {
        console.log("✅ Kafka Connect is ready!");
        return;
      }
    } catch {
      // Connection failed, retry
    }
    console.log(`   Waiting... (${i}/${maxAttempts})`);
    await sleep(2000);
  }

  throw new Error(`Kafka Connect not ready after ${maxAttempts * 2}s`);
}

export async function deleteConnectorIfExists(
  url: string,
  connectorName: string
): Promise<void> {
  try {
    const response = await fetch(`${url}/connectors/${connectorName}`);
    if (response.ok) {
      console.log(`♻️  Deleting existing connector... ${connectorName}`);
      await fetch(`${url}/connectors/${connectorName}`, { method: "DELETE" });
      await sleep(2000);
      console.log(`✅ Connector deleted successfully! ${connectorName}`);
    }
  } catch {
    // Connector doesn't exist, that's fine
  }
}

export async function createConnector(
  url: string,
  config: ConnectorConfig
): Promise<void> {
  console.log(`🔌 Creating Debezium connector... ${config.name}`);

  const response = await fetch(`${url}/connectors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  const result = await response.json();

  if (response.ok && result.name) {
    console.log("✅ Connector created successfully!");
  } else {
    console.error("❌ Failed to create connector:");
    console.error(JSON.stringify(result, null, 2));
    throw new Error("Connector creation failed");
  }
}
