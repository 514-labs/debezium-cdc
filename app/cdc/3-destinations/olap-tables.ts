// ClickHouse OLAP table definitions
// Uses ReplacingMergeTree engine for CDC - this engine deduplicates rows
// based on the 'ver' field (ts_ms) and respects the 'isDeleted' flag.

import { OlapTable, ClickHouseEngines } from "@514labs/moose-lib";
import { OlapAnotherTable, OlapCustomerAddress } from "../../models";

export const olapCustomerAddresses = new OlapTable<OlapCustomerAddress>(
  "customer_addresses",
  {
    engine: ClickHouseEngines.ReplacingMergeTree,
    ver: "lsn", // Version field for deduplication
    isDeleted: "_is_deleted", // Soft delete marker
    orderByFields: ["id"], // Sorting key (also used for dedup)
  }
);

export const olapAnotherTable = new OlapTable<OlapAnotherTable>(
  "another_table",
  {
    engine: ClickHouseEngines.ReplacingMergeTree,
    ver: "lsn",
    isDeleted: "_is_deleted",
    orderByFields: ["id"],
  }
);
