import {
  LowCardinality,
  OlapTable,
  Stream,
  ClickHouseEngines,
  UInt8,
  cliLog,
  UInt64,
  DateTime,
} from "@514labs/moose-lib";

import { CustomerAddress, AnotherTable } from "./db/schema";

import { cdcCustomerAddresses } from "./cdc-topics/externalTopics";

type CdcFields = {
  _is_deleted: UInt8;
  ts_ms: UInt64;
};

type OlapAnotherTable = Omit<AnotherTable, "id" | "random_number"> &
  CdcFields & {
    id: UInt64;
    random_number: UInt64;
  };

type OlapCustomerAddress = Omit<CustomerAddress, "id" | "country" | "state"> &
  CdcFields & {
    id: UInt64;
    country: string & LowCardinality;
    state: string & LowCardinality;
  };

interface ICustomerAddress {
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
  _is_deleted: UInt8;
  ts_ms: UInt64;
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
type AnotherTableChangeEvent = GenericCDCEvent<AnotherTable>;

// const olapAnotherTable = new OlapTable<OlapAnotherTable>("another_table", {
//   engine: ClickHouseEngines.ReplacingMergeTree,
//   ver: "ts_ms",
//   isDeleted: "_is_deleted",
//   orderByFields: ["id"],
// });

const olapCustomerAddresses = new OlapTable<ICustomerAddress>(
  "customer_addresses",
  {
    engine: ClickHouseEngines.ReplacingMergeTree,
    ver: "ts_ms",
    isDeleted: "_is_deleted",
    orderByFields: ["id"],
  }
);

const ProcessedCustomerAddresses = new Stream<ICustomerAddress>(
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
    return result as ICustomerAddress;
  }
);
