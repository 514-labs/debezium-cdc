// This file wraps the auto-generated topics with proper TypeScript types.
// Why? The codegen creates empty types ({}), so we cast them here to get type safety.
// This pattern keeps your types intact even when running `moose kafka pull`.

import { Stream } from "@514labs/moose-lib";
import {
  PgCdcPublicAnotherTable,
  PgCdcPublicCustomerAddresses,
} from "./externalTopics";
import {
  AnotherTableChangeEvent,
  CustomerAddressChangeEvent,
} from "../../models";

// Type-safe CDC streams - use these in your transforms!
export const cdcAnotherTable =
  PgCdcPublicAnotherTable as Stream<AnotherTableChangeEvent>;
export const cdcCustomerAddresses =
  PgCdcPublicCustomerAddresses as Stream<CustomerAddressChangeEvent>;
