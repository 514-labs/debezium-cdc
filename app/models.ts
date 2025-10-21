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

// OlapCustomerAddress demonstrates selective field mapping:
// Fields inherited as-is from CustomerAddress 
// (keeping original type; all fields non-nullable unless expressly made nullable):
export type OlapCustomerAddress = Omit<
  CustomerAddress,
  "id" | "country" | "state" | "work_address" | "phone_2"
> &
  CdcFields & {
    id: UInt64;						              // stricter type
    country: string & LowCardinality;		// stricter type
    state: string & LowCardinality;			// stricter type
    work_address: string & ClickHouseDefault<"''">;	// default instead of nullable
    phone_2?: string;		                // nullable (best practice if 95%+ empty column)
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
