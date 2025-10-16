// Intermediate streams connect transforms to OLAP tables
// Think of these as the "pipes" between your transform logic and ClickHouse

import { Stream } from "@514labs/moose-lib";
import { OlapAnotherTable, OlapCustomerAddress } from "../../models";
import { olapCustomerAddresses, olapAnotherTable } from "./olap-tables";

export const processedCustomerAddresses = new Stream<OlapCustomerAddress>(
  "ProcessedCustomerAddresses",
  { destination: olapCustomerAddresses }
);

export const processedAnotherTable = new Stream<OlapAnotherTable>(
  "ProcessedAnotherTable",
  { destination: olapAnotherTable }
);
