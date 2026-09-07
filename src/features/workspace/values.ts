import { sha256 } from "@noble/hashes/sha256";
import { to32Bytes } from "../../contract/sdk";

export const hex = (value: Uint8Array | number[]) =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
export const hashInput = (value: string) => to32Bytes(value.trim());
export function memberIds(input: string) {
  const values = input
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(hashInput);
  if (!values.length) throw new Error("Enter at least one canonical ID.");
  if (new Set(values.map(hex)).size !== values.length)
    throw new Error("Member IDs must be unique.");
  return values;
}

/** Incremental browser hashing. Contents stay local and are never sent to RPC. */
export async function hashFile(
  file: File,
  progress: (percent: number) => void = () => {},
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const digest = sha256.create();
  const chunkSize = 2 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    signal?.throwIfAborted();
    const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer();
    signal?.throwIfAborted();
    digest.update(new Uint8Array(chunk));
    progress(
      Math.min(100, Math.round(((offset + chunkSize) / file.size) * 100)),
    );
  }
  progress(100);
  return hex(digest.digest());
}

export function timestamp(value: { toString(): string }) {
  const seconds = BigInt(value.toString());
  if (seconds < -8640000000000n || seconds > 8640000000000n)
    return `${seconds} seconds since epoch`;
  return new Date(Number(seconds) * 1000).toISOString();
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
