import { z } from "zod";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { RestoreProofInput } from "../../contract/sdk";
import { accountPublicKey } from "../../contract/sdk";
import { hex } from "../workspace/values";

const byteArray = z.array(z.number().int().min(0).max(255));
const bytes = z
  .union([z.string().regex(/^(?:[0-9a-fA-F]{2})*$/), byteArray])
  .transform((value) =>
    typeof value === "string"
      ? Array.from(value.match(/../g) || [], (byte) => parseInt(byte, 16))
      : value,
  );
const hash = bytes.refine(
  (value) => value.length === 32,
  "Expected exactly 32 bytes",
);
const integer = z
  .union([z.string().regex(/^-?\d+$/), z.number().int().safe()])
  .transform(BigInt);
const u64 = integer.refine(
  (value) => value >= 0n && value < 1n << 64n,
  "Expected u64",
);
const i64 = integer.refine(
  (value) => value >= -(1n << 63n) && value < 1n << 63n,
  "Expected i64",
);
const key = z.union([z.string(), byteArray]).transform((value, ctx) => {
  try {
    return accountPublicKey(value);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid public key",
    });
    return z.NEVER;
  }
});
const fingerprint = z
  .object({
    hash,
    sourceKind: z.number().int().min(0).max(4),
    createdAt: i64,
    generation: u64,
  })
  .strict();
const source = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hash") }).strict(),
  z.object({ kind: z.literal("account"), account: key }).strict(),
  z
    .object({
      kind: z.literal("branch"),
      previousHashId: hash,
      payload: hash,
      generation: u64,
    })
    .strict(),
  z
    .object({ kind: z.literal("batch"), members: z.array(hash).min(1) })
    .strict(),
  z.object({ kind: z.literal("pack") }).strict(),
]);
const params = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hash"), payload: bytes }).strict(),
  z
    .object({
      kind: z.literal("account"),
      snapshot: z
        .object({
          owner: key,
          lamports: u64,
          rentEpoch: u64,
          executable: z.boolean(),
          data: bytes,
        })
        .strict()
        .optional(),
    })
    .strict(),
  z.object({ kind: z.literal("branch"), parent: fingerprint }).strict(),
  z
    .object({ kind: z.literal("batch"), members: z.array(fingerprint).min(1) })
    .strict(),
  z
    .object({ kind: z.literal("pack"), members: z.array(fingerprint).min(1) })
    .strict(),
]);
const proof = z
  .array(
    z
      .object({
        hash,
        source,
        createdAt: i64.refine(
          (value) => value !== 0n,
          "Timestamp cannot be zero",
        ),
        params: params.nullish(),
      })
      .strict(),
  )
  .min(1)
  .max(64);

export function parseProof(
  input: string,
  expected?: { programId: string; rpc: string },
): RestoreProofInput[] {
  if (input.length > 2_000_000)
    throw new Error("Proof JSON exceeds the 2 MB import limit.");
  const document: unknown = JSON.parse(input);
  // A portable download may carry network metadata; a plain SDK-shaped array is accepted too.
  const envelope = Array.isArray(document)
    ? document
    : z
        .object({
          format: z.literal("hash-timestamp-proof-v1"),
          programId: key,
          rpc: z.string(),
          proof: z.unknown(),
        })
        .strict()
        .parse(document);
  if (
    !Array.isArray(envelope) &&
    expected &&
    (envelope.programId.toBase58() !== expected.programId ||
      envelope.rpc !== expected.rpc)
  ) {
    throw new Error(
      "This proof export belongs to another program or RPC. Select its original network first.",
    );
  }
  return proof.parse(
    Array.isArray(envelope) ? envelope : envelope.proof,
  ) as RestoreProofInput[];
}

function portable(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (BN.isBN(value)) return String(value);
  if (value instanceof PublicKey) return value.toBase58();
  if (value instanceof Uint8Array) return hex(value);
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, portable(entry)]),
    );
  return value;
}

export function proofJson(
  proof: RestoreProofInput[],
  programId: string,
  rpc: string,
) {
  return JSON.stringify(
    {
      format: "hash-timestamp-proof-v1",
      programId,
      rpc,
      proof: portable(proof),
    },
    null,
    2,
  );
}

export function downloadJson(name: string, contents: string) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
