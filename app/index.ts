import {
  LowCardinality,
  OlapTable,
  Stream,
  ClickHouseEngines,
  UInt8,
  cliLog,
  UInt64,
} from "@514labs/moose-lib";

import { cdcCustomerAddresses } from "./cdc-topics/externalTopics";

interface CustomerAddress {
  id: UInt64;
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
  contentId: string;
  payload: {
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
  };
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

cdcCustomerAddresses.addTransform(
  ProcessedCustomerAddresses,
  async (message) => {
    const { contentId, payload } =
      message as IncomingCustomerAddressChangeEvent;

    cliLog({
      action: "cdcCustomerAddresses",
      message: JSON.stringify(message),
    });

    if (payload.op === "d") {
      return {
        ...payload.before,
        _is_deleted: 1,
        ts_ms: payload.ts_ms,
      };
    } else if (payload.op === "c" || payload.op === "u" || payload.op === "r") {
      return {
        ...payload.after,
        _is_deleted: 0,
        ts_ms: payload.ts_ms,
      };
    } else throw new Error(`Invalid operation: ${payload.op}`);
  }
);
