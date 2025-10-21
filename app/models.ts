import { UInt8, UInt64, LowCardinality, ClickHouseDefault } from "@514labs/moose-lib";
import { CustomerAddress, AnotherTable } from "./oltp/schema";

export type CdcFields = {
  _is_deleted: UInt8;
  ts_ms: UInt64;
  lsn: UInt64;
};

export type OlapAnotherTable = Omit<AnotherTable, "id" | "random_number"> &
  CdcFields & {
    id: UInt64;
    random_number: UInt64;
  };

export type OlapCustomerAddress = Omit<
  CustomerAddress,
  "id" | "country" | "state" | "res_address" | "work_address" | "phone_1" | "phone_2"
> &
  CdcFields & {
    id: UInt64;
    country: string & LowCardinality & ClickHouseDefault<"'UNKNOWN'">;
    state: string & LowCardinality & ClickHouseDefault<"'UNKNOWN'">;
    res_address: string & ClickHouseDefault<"''">;
    work_address: string & ClickHouseDefault<"''">;
    phone_1: string & ClickHouseDefault<"''">;
    phone_2: string & ClickHouseDefault<"''">;
  };

export type GenericCDCEvent<T> = {
  schemaId: string;
  payload: {
    before: T | null;
    after: T | null;
    source: {
      version: string;
      connector: string;
      name: string;
      sequence: string[];
      ts_ms: number;
      snapshot: boolean;
      db: string;
      table: string;
      txId: number;
      lsn: number;
      xmin: string | null;
    };
    transaction: string | null;
    op: "c" | "u" | "d" | "r";
    ts_ms: number;
    ts_us: number;
    ts_ns: number;
  };
};

export type CustomerAddressChangeEvent = GenericCDCEvent<CustomerAddress>;
export type AnotherTableChangeEvent = GenericCDCEvent<AnotherTable>;
