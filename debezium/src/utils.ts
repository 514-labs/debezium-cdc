/**
 * Utility functions
 */

import { execSync } from "child_process";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMooseRunning(): boolean {
  try {
    execSync("nc -z localhost 19092", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

