// Generic CDC event handler that works for any Debezium payload.
// This demonstrates the standard pattern for processing CDC events:
// - Log the operation for debugging
// - Handle deletes (op: 'd') by marking _is_deleted = 1
// - Handle creates/updates/reads by using the 'after' snapshot

import { cliLog } from "@514labs/moose-lib";
import { GenericCDCEvent, CdcFields } from "../models";

export function handleCDCPayload<T>(event: GenericCDCEvent<T>): T & CdcFields {
  // Log transaction details for observability
  cliLog({
    action: "CDC Transform",
    message: `LSN: ${event.source.lsn} | TABLE: ${event.source.table} | OPERATION: ${event.op}`,
  });

  cliLog({
    action: "Raw Payload",
    message: JSON.stringify(event),
  });

  let result = {} as T & CdcFields;
  if (event.op === "d") {
    // Soft delete: keep the record but mark it deleted
    result = {
      ...event.before!,
      _is_deleted: 1,
      ts_ms: event.ts_ms,
      lsn: event.source.lsn,
    };
  }

  if (
    event.op === "c" || // create
    event.op === "u" || // update
    event.op === "r" // read (snapshot)
  ) {
    result = {
      ...event.after!,
      _is_deleted: 0,
      ts_ms: event.ts_ms,
      lsn: event.source.lsn,
    };
  }

  if (!result) {
    throw new Error(`Unexpected CDC operation: ${event.op}`);
  }

  cliLog({
    action: "Result",
    message: `Operation: ${event.op} | Result: ${JSON.stringify(result)}`,
  });

  return result;
}
