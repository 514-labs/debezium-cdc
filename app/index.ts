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

type GenericCDCEvent<T> = {
  contentId: string;
  payload: {
    before: T | null;
    after: T | null;
    op: "c" | "u" | "d" | "r";
    ts_ms: number;
  };
};

type CustomerAddressChangeEvent = GenericCDCEvent<CustomerAddress>;

const olapCustomerAddresses = new OlapTable<IProcessedCustomerAddresses>(
  "customer_addresses",
  {
    engine: ClickHouseEngines.ReplacingMergeTree,
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

function handleCDCPayload(event: GenericCDCEvent<any>) {
  if (event.payload.op === "d") {
    return {
      ...event.payload.before,
      _is_deleted: 1,
      ts_ms: event.payload.ts_ms,
    };
  } else if (
    event.payload.op === "c" ||
    event.payload.op === "u" ||
    event.payload.op === "r"
  ) {
    return {
      ...event.payload.after,
      _is_deleted: 0,
      ts_ms: event.payload.ts_ms,
    };
  } else throw new Error(`Invalid operation: ${event.payload.op}`);
}

cdcCustomerAddresses.addTransform(
  ProcessedCustomerAddresses,
  async (message) => {
    cliLog({
      action: "cdcCustomerAddresses",
      message: JSON.stringify(message),
    });

    const result = handleCDCPayload(message as CustomerAddressChangeEvent);
    return result as IProcessedCustomerAddresses;
  }
);
