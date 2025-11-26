// AUTO-GENERATED FILE. DO NOT EDIT.
// This file will be replaced when you run `moose kafka pull`.

import { Stream, LifeCycle } from "@514labs/moose-lib";

export const PgCdcPublicAnotherTableStream = new Stream<{}>(
  "pg-cdc.public.another_table",
  { lifeCycle: LifeCycle.EXTERNALLY_MANAGED }
);
export const PgCdcPublicCustomerAddressesStream = new Stream<{}>(
  "pg-cdc.public.customer_addresses",
  { lifeCycle: LifeCycle.EXTERNALLY_MANAGED }
);
