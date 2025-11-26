// This file wraps the auto-generated topics with proper TypeScript types.
// Why? The codegen creates empty types ({}), so we cast them here to get type safety.
// This pattern keeps your types intact even when running `moose kafka pull`.

import { Stream } from "@514labs/moose-lib";
import {
  PgCdcPublicAnotherTableStream,
  PgCdcPublicCustomerAddressesStream,
} from "./externalTopics";
import { GenericCDCEvent } from "../models";
import { AnotherTable, CustomerAddress } from "../../postgres/src/schema";

// Type-safe CDC streams - use these in your transforms!
// Using double cast (as unknown as) because auto-generated Stream<{}> types
// need to be cast to the actual CDC event structure
export const cdcAnotherTable =
  PgCdcPublicAnotherTableStream as unknown as Stream<
    GenericCDCEvent<AnotherTable>
  >;
export const cdcCustomerAddresses =
  PgCdcPublicCustomerAddressesStream as unknown as Stream<
    GenericCDCEvent<CustomerAddress>
  >;
