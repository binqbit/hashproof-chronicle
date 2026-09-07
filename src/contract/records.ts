import { PublicKey, SystemProgram, type AccountInfo } from "@solana/web3.js";
import {
  canonicalHashId,
  decodeHashSource,
  to32Bytes,
  type HashAccountData,
  type HashTimestampClient,
} from "./sdk";

export interface ResolvedRecord {
  id: string;
  pda: PublicKey;
  account: HashAccountData | null;
}

/** Hex defaults to a canonical ID. Base58 checks both interpretations against live data. */
export async function resolveRecord(
  client: HashTimestampClient,
  input: string,
): Promise<ResolvedRecord> {
  const match = /^(id|pda):\s*(.*)$/i.exec(input.trim());
  const mode = match?.[1].toLowerCase();
  const value = match ? match[2] : input.trim();
  let bytes: Uint8Array;
  try {
    bytes = to32Bytes(value);
  } catch {
    throw new Error(
      "Enter a 32-byte canonical ID or PDA in hex or Base58; use id: or pda: to specify its type.",
    );
  }
  const canonical = Buffer.from(bytes).toString("hex");
  const derived = client.hashPda(canonical);
  const direct = new PublicKey(bytes);
  if (mode === "id" || (!mode && /^[a-f\d]{64}$/i.test(value))) {
    const account = verifyRecord(
      client,
      derived,
      await client.connection.getAccountInfo(derived),
      canonical,
    );
    return account ?? { id: canonical, pda: derived, account: null };
  }
  if (mode === "pda") {
    const account = verifyRecord(
      client,
      direct,
      await client.connection.getAccountInfo(direct),
    );
    if (account) return account;
    throw new Error(
      "A closed PDA cannot reveal its canonical ID; use id: followed by the ID from retained history.",
    );
  }

  // Never treat RPC failures as absence. Only validation errors belong to one interpretation.
  const infos = await Promise.all(
    [direct, derived].map((pda) => client.connection.getAccountInfo(pda)),
  );
  const records: ResolvedRecord[] = [];
  const errors: unknown[] = [];
  for (const [index, pda] of [direct, derived].entries()) {
    try {
      const record = verifyRecord(
        client,
        pda,
        infos[index],
        index === 1 ? canonical : undefined,
      );
      if (record) records.push(record);
    } catch (error) {
      errors.push(error);
    }
  }
  if (new Set(records.map((record) => record.id)).size > 1)
    throw new Error(
      "Ambiguous Base58 value: both an ID and a PDA resolve to live records. Use id: or pda:.",
    );
  if (records.length) return records[0];
  if (errors.length) throw errors[0];
  throw new Error(
    "No live record found. A closed PDA cannot reveal its canonical ID; for a Base58 canonical ID use id: followed by the value.",
  );
}

/** A PDA is not invertible. Recover its ID only from verified live account data. */
function verifyRecord(
  client: HashTimestampClient,
  pda: PublicKey,
  info: AccountInfo<Buffer> | null,
  canonical?: string,
): ResolvedRecord | null {
  if (
    !info ||
    (info.owner.equals(SystemProgram.programId) &&
      !info.executable &&
      info.data.length === 0)
  ) {
    return null;
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
  if (
    !client.hashPda(id).equals(pda) ||
    (canonical !== undefined && id !== canonical)
  )
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
