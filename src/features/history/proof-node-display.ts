import {
  Box,
  Boxes,
  Fingerprint,
  GitBranch,
  HelpCircle,
  Wallet,
} from "lucide-react";
import type { ArchiveNode } from "../../contract/sdk";

const icons = {
  hash: Fingerprint,
  branch: GitBranch,
  batch: Boxes,
  pack: Box,
  account: Wallet,
};
export const proofNodeIcon = (kind?: ArchiveNode["source"]["kind"]) =>
  kind ? icons[kind] : HelpCircle;

/** Presentation only: keep the original signed timestamp untouched in the proof. */
export function proofRecordedDate(value: string) {
  const seconds = BigInt(value);
  if (seconds < -8640000000000n || seconds > 8640000000000n) return null;
  const date = new Date(Number(seconds) * 1000);
  return {
    iso: date.toISOString(),
    day: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
      ...(date.getUTCFullYear() <= 0 ? { era: "short" as const } : {}),
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(date),
  };
}
