import {
  LowCardinality,
  OlapTable,
  Stream,
  ClickHouseEngines,
  UInt8,
} from "@514labs/moose-lib";

import { ShopServerPublicCustomerAddresses } from "./external-topics/externalTopics";

interface CustomerAddress {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  res_address: string;
  work_address: string;
  country: string & LowCardinality;
  state: string & LowCardinality;
  phone_1: string;
  phone_2: string;
}
interface IProcessedCustomerAddresses extends CustomerAddress {
  _is_deleted: UInt8;
  ts_ms: number;
}

interface IncomingCustomerAddressChangeEvent {
  before: CustomerAddress | null;
  after: CustomerAddress | null;
  source: {
    version: string;
    connector: string;
    name: string;
    ts_ms: number;
    snapshot: boolean;
    db: string;
    schema: string;
    sequence: string[];
    table: string;
    txId: number;
    lsn: number;
    xmin: string | null;
  };
  op: "c" | "u" | "d" | "r";
  ts_ms: number;
}

const olapCustomerAddresses = new OlapTable<IProcessedCustomerAddresses>(
  "customer_addresses",
  {
    engine: ClickHouseEngines.ReplicatedReplacingMergeTree,
    ver: "ts_ms",
    isDeleted: "_is_deleted",
    orderByFields: ["id", "ts_ms"],
  }
);

const ProcessedCustomerAddresses = new Stream<IProcessedCustomerAddresses>(
  "ProcessedCustomerAddresses",
  {
    destination: olapCustomerAddresses,
  }
);

ShopServerPublicCustomerAddresses.addTransform(
  ProcessedCustomerAddresses,
  async (message) => {
    const data = message as IncomingCustomerAddressChangeEvent;
    if (data.op === "d") {
      return {
        ...data.before,
        _is_deleted: 1,
        ts_ms: data.ts_ms,
      };
    } else if (data.op === "c" || data.op === "u" || data.op === "r") {
      return {
        ...data.after,
        _is_deleted: 0,
        ts_ms: data.ts_ms,
      };
    } else throw new Error(`Invalid operation: ${data.op}`);
  }
);
