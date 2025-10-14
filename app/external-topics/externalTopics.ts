// AUTO-GENERATED FILE. DO NOT EDIT.
// This file will be replaced when you run `moose kafka pull`.

import { Stream, LifeCycle, cliLog } from "@514labs/moose-lib";

export const ConnectConfigs = new Stream<{}>("connect_configs", {
  lifeCycle: LifeCycle.EXTERNALLY_MANAGED,
});
export const ConnectOffsets = new Stream<{}>("connect_offsets", {
  lifeCycle: LifeCycle.EXTERNALLY_MANAGED,
});
export const ConnectStatuses = new Stream<{}>("connect_statuses", {
  lifeCycle: LifeCycle.EXTERNALLY_MANAGED,
});
export const ShopServerPublicCustomerAddresses = new Stream<{}>(
  "shop-server.public.customer_addresses",
  { lifeCycle: LifeCycle.EXTERNALLY_MANAGED }
);

ShopServerPublicCustomerAddresses.addConsumer(async (message) => {
  cliLog({
    action: "ShopServerPublicCustomerAddresses",
    message: JSON.stringify(message),
  });
});
