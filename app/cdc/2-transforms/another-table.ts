// Transform for another_table
// Pattern: CDC Source → Transform Function → Intermediate Stream → OLAP Table

import { cdcAnotherTable } from "../1-sources/typed-topics";
import { processedAnotherTable } from "../3-destinations/intermediate-streams";
import { handleCDCPayload } from "./payload-handler";
import { GenericCDCEvent, OlapAnotherTable } from "../../models";
import { AnotherTable } from "../../oltp/schema";

// Register the transform - this runs for every message on the CDC topic
cdcAnotherTable.addTransform(
  processedAnotherTable,
  (message: GenericCDCEvent<AnotherTable>) => {
    const result = handleCDCPayload<AnotherTable>(message);
    return result as OlapAnotherTable;
  }
);
