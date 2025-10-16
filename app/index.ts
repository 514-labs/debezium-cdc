// Entry point - imports all transforms to register them with Moose
// Each import statement activates a CDC pipeline:
//   Kafka Topic → Transform → ClickHouse Table

export * from "./cdc/1-sources/typed-topics";
export * from "./cdc/2-transforms/another-table";
export * from "./cdc/2-transforms/customer-addresses";
export * from "./cdc/3-destinations/olap-tables";
export * from "./cdc/3-destinations/intermediate-streams";
