import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  canonicalHashId,
  decodeHashSource,
  type HashAccountData,
  type HashTimestampClient,
} from "./sdk";

export interface ResolvedRecord {
  id: string;
  pda: PublicKey;
  account: HashAccountData | null;
}

/** A PDA is an address, not an invertible hash. Recover its ID only from verified live data. */
export async function resolveRecord(
  client: HashTimestampClient,
  input: string,
): Promise<ResolvedRecord> {
  const value = input.trim();
  const canonical = /^[a-f\d]{64}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
  let pda: PublicKey;
  try {
    pda = canonical ? client.hashPda(canonical) : new PublicKey(value);
  } catch {
    throw new Error(
      "Enter a canonical ID (64 hex characters) or a record PDA (base58).",
    );
  }
  const info = await client.connection.getAccountInfo(pda);
  if (
    !info ||
    (info.owner.equals(SystemProgram.programId) &&
      !info.executable &&
      info.data.length === 0)
  ) {
    if (!canonical)
      throw new Error(
        "No live record at this PDA. A closed PDA cannot reveal its canonical ID; use the ID from retained history.",
      );
    return { id: canonical, pda, account: null };
  }
  if (!info.owner.equals(client.programId) || info.executable)
    throw new Error(
      "This address is not a hash record owned by the selected program.",
    );
  let account: HashAccountData;
  try {
    account = client.program.coder.accounts.decode<HashAccountData>(
      "hashAccount",
      info.data,
    );
  } catch {
    throw new Error(
      "This program account is not a valid hash record (wrong type or corrupt data).",
    );
  }
  const id = Buffer.from(
    canonicalHashId(account.hash, decodeHashSource(account.source)),
  ).toString("hex");
  if (!client.hashPda(id).equals(pda) || (canonical && id !== canonical))
    throw new Error("Record data does not match its canonical ID and PDA.");
  return { id, pda, account };
}

export async function resolveLiveRecord(
  client: HashTimestampClient,
  input: string,
) {
  const record = await resolveRecord(client, input);
  if (!record.account) throw new Error(`Record is not live: ${record.id}`);
  return { ...record, account: record.account };
}

export async function resolveMembers(
  client: HashTimestampClient,
  input: string,
) {
  const values = input
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!values.length) throw new Error("Enter at least one member ID or PDA.");
  if (values.length > 32)
    throw new Error("The UI supports at most 32 members per operation.");
  const records = await Promise.all(
    values.map((value) => resolveLiveRecord(client, value)),
  );
  if (new Set(records.map((record) => record.id)).size !== records.length)
    throw new Error(
      "Members must be unique: an ID and its PDA identify the same record.",
    );
  return records;
}
