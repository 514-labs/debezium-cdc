// Generic CDC event handler that works for any Debezium payload.
// This demonstrates the standard pattern for processing CDC events:
// - Log the operation for debugging
// - Handle deletes (op: 'd') by marking _is_deleted = 1
// - Handle creates/updates/reads by using the 'after' snapshot

import { cliLog } from "@514labs/moose-lib";
import { GenericCDCEvent, CdcFields } from "../../models";

export function handleCDCPayload<T>(event: GenericCDCEvent<T>): T & CdcFields {
  // Log transaction details for observability
  cliLog({
    action: "CDC Transform",
    message: `LSN: ${event.payload.source.lsn} | TABLE: ${event.payload.source.table} | OPERATION: ${event.payload.op}`,
  });

  cliLog({
    action: "CDC Payload",
    message: `PAYLOAD: ${JSON.stringify(event.payload)}`,
  });

  if (event.payload.op === "d") {
    // Soft delete: keep the record but mark it deleted
    return {
      ...event.payload.before!,
      _is_deleted: 1,
      ts_ms: event.payload.ts_ms,
      lsn: event.payload.source.lsn,
    };
  } else if (
    event.payload.op === "c" || // create
    event.payload.op === "u" || // update
    event.payload.op === "r" // read (snapshot)
  ) {
    return {
      ...event.payload.after!,
      _is_deleted: 0,
      ts_ms: event.payload.ts_ms,
      lsn: event.payload.source.lsn,
    };
  } else {
    throw new Error(`Unexpected CDC operation: ${event.payload.op}`);
  }
}
