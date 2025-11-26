// Entry point - imports all transforms to register them with Moose
// Each import statement activates a CDC pipeline:
//   Kafka Topic → Transform → ClickHouse Table

export * from "./1-sources/typed-topics";
export * from "./2-transforms/another-table";
export * from "./2-transforms/customer-addresses";
export * from "./3-destinations/olap-tables";
export * from "./3-destinations/sink-topics";
