import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { HashTimestampClient, IDL } from "./sdk";
import type { HashTimestamp } from "./sdk";

export const PROGRAM_ID = new PublicKey(IDL.address);
export const PROGRAM_VERSION = IDL.metadata.version;

export function createReadClient(connection: Connection) {
  return new HashTimestampClient(
    new Program<HashTimestamp>(IDL, { connection }),
  );
}

export function createSigningClient(
  connection: Connection,
  wallet: AnchorProvider["wallet"],
) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new HashTimestampClient(new Program<HashTimestamp>(IDL, provider));
}
