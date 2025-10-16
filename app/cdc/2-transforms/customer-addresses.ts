// Transform for customer_addresses table
// Pattern: CDC Source → Transform Function → Intermediate Stream → OLAP Table

import { cdcCustomerAddresses } from "../1-sources/typed-topics";
import { processedCustomerAddresses } from "../3-destinations/intermediate-streams";
import { handleCDCPayload } from "./payload-handler";
import { GenericCDCEvent, OlapCustomerAddress } from "../../models";
import { CustomerAddress } from "../../oltp/schema";

// Register the transform - this runs for every message on the CDC topic
cdcCustomerAddresses.addTransform(
  processedCustomerAddresses,
  (message: GenericCDCEvent<CustomerAddress>) => {
    const result = handleCDCPayload<CustomerAddress>(message);
    return result as OlapCustomerAddress;
  }
);
