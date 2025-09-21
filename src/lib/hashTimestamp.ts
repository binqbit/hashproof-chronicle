import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  Connection,
  TransactionSignature,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { HashTimestamp, HashAccount, VoteInfo } from "../types/hash_timestamp";

// Real program ID from the deployed HashTimestamp program
export const PROGRAM_ID = new PublicKey("HTSx1VNWNBDGtfwr2nU8gSzhxfFtUxd2nkdFq7SCSZzY");

// Re-export types for convenience
export type { HashAccount, VoteInfo };

// Must match on-chain layout
export const HASH_ACCOUNT_SPACE = 8 /*disc*/ + 32 + 8 + 8 + 1 + 7; // 64 bytes
export const VOTE_ACCOUNT_SPACE = 8 /*disc*/ + 32 + 32 + 8 + 1 + 7; // 88 bytes
const MIN_BALANCE_BUFFER = 0.002 * LAMPORTS_PER_SOL;

export type HashBytes = Uint8Array | number[] | string;

const textEncoder = new TextEncoder();
const HASH_SEED = textEncoder.encode("hash");
const VOTE_SEED = textEncoder.encode("vote");

export function to32Bytes(input: HashBytes): Uint8Array {
  if (typeof input === "string") {
    const normalized = input.startsWith("0x") ? input.slice(2) : input;
    if (normalized.length !== 64) {
      throw new Error("hash must be exactly 32 bytes");
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      const byte = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
      if (Number.isNaN(byte)) {
        throw new Error("hash contains non-hex characters");
      }
      bytes[i] = byte;
    }
    return bytes;
  }

  if (input instanceof Uint8Array) {
    if (input.length !== 32) {
      throw new Error("hash must be exactly 32 bytes");
    }
    return new Uint8Array(input);
  }

  if (Array.isArray(input)) {
    if (input.length !== 32) {
      throw new Error("hash must be exactly 32 bytes");
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      const value = input[i];
      if (typeof value !== "number" || value < 0 || value > 255) {
        throw new Error("hash array must contain byte values");
      }
      bytes[i] = value;
    }
    return bytes;
  }

  throw new TypeError("Unsupported hash input type");
}

export function deriveHashPda(
  programId: PublicKey,
  hash: HashBytes
): PublicKey {
  const hashBytes = to32Bytes(hash);
  const [pda] = PublicKey.findProgramAddressSync(
    [HASH_SEED, hashBytes],
    programId
  );
  return pda;
}

export function deriveVotePda(
  programId: PublicKey,
  hashPda: PublicKey,
  voter: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [VOTE_SEED, hashPda.toBuffer(), voter.toBuffer()],
    programId
  );
  return pda;
}

export async function rentExemptForHash(conn: Connection): Promise<number> {
  return conn.getMinimumBalanceForRentExemption(HASH_ACCOUNT_SPACE);
}

export class HashTimestampClient {
  readonly program: Program<HashTimestamp>;
  constructor(program: Program<HashTimestamp>) {
    this.program = program;
  }

  get connection(): Connection {
    return this.program.provider.connection;
  }
  get programId(): PublicKey {
    return this.program.programId;
  }

  hashPda(hash: HashBytes): PublicKey {
    return deriveHashPda(this.programId, hash);
  }
  votePda(hashPda: PublicKey, voter: PublicKey): PublicKey {
    return deriveVotePda(this.programId, hashPda, voter);
  }

  async vote(hash: HashBytes, payer?: Keypair): Promise<TransactionSignature> {
    const hashBytes = to32Bytes(hash);
    const provider = this.program.provider as anchor.AnchorProvider;
    const walletPk = payer ? payer.publicKey : provider.wallet.publicKey;
    const hashPda = this.hashPda(hashBytes);
    const votePda = this.votePda(hashPda, walletPk);

    if (!payer) {
      const connection = provider.connection;
      const [hashAccountInfo, voteAccountInfo] = await Promise.all([
        connection.getAccountInfo(hashPda),
        connection.getAccountInfo(votePda),
      ]);

      let requiredLamports = MIN_BALANCE_BUFFER;
      if (!hashAccountInfo) {
        requiredLamports += await connection.getMinimumBalanceForRentExemption(
          HASH_ACCOUNT_SPACE
        );
      }
      if (!voteAccountInfo) {
        requiredLamports += await connection.getMinimumBalanceForRentExemption(
          VOTE_ACCOUNT_SPACE
        );
      }

      const balance = await connection.getBalance(walletPk);
      if (balance < requiredLamports) {
        const requiredSol = requiredLamports / LAMPORTS_PER_SOL;
        const shortfallSol = (requiredLamports - balance) / LAMPORTS_PER_SOL;
        throw new Error(
          'Insufficient SOL to create timestamp accounts. Need at least ' +
            requiredSol.toFixed(3) +
            ' SOL (short ' +
            shortfallSol.toFixed(3) +
            ' SOL). Use a devnet faucet to top up your wallet.'
        );
      }
    }

    const builder = this.program.methods.vote([...hashBytes]).accountsStrict({
      hashAccount: hashPda,
      voteInfo: votePda,
      user: walletPk,
      systemProgram: SystemProgram.programId,
    });

    if (payer) {
      return builder.signers([payer]).rpc();
    }
    return builder.rpc();
  }

  async unvote(
    hash: HashBytes,
    payer?: Keypair
  ): Promise<TransactionSignature> {
    const hashBytes = to32Bytes(hash);
    const provider = this.program.provider as anchor.AnchorProvider;
    const walletPk = payer ? payer.publicKey : provider.wallet.publicKey;
    const hashPda = this.hashPda(hashBytes);
    const votePda = this.votePda(hashPda, walletPk);

    const builder = this.program.methods.unvote([...hashBytes]).accountsStrict({
      hashAccount: hashPda,
      voteInfo: votePda,
      user: walletPk,
      systemProgram: SystemProgram.programId,
    });

    if (payer) {
      return builder.signers([payer]).rpc();
    }
    return builder.rpc();
  }

  async verify(hash: HashBytes): Promise<TransactionSignature> {
    const hashBytes = to32Bytes(hash);
    const hashPda = this.hashPda(hashBytes);
    return this.program.methods
      .verify([...hashBytes])
      .accountsStrict({ hashAccount: hashPda })
      .rpc();
  }

  // Account helpers
  async fetchHashAccount(hash: HashBytes) {
    const hashPda = this.hashPda(hash);
    // Prefer fetchNullable to avoid throwing on closed/cleared accounts
    // @ts-ignore - older Anchor types may not have fetchNullable in types
    if (this.program.account.hashAccount.fetchNullable) {
      // @ts-ignore
      return this.program.account.hashAccount.fetchNullable(hashPda);
    }
    try {
      return await this.program.account.hashAccount.fetch(hashPda);
    } catch (_) {
      return null;
    }
  }

  async fetchVoteInfo(hash: HashBytes, voter: PublicKey) {
    const hashPda = this.hashPda(hash);
    const votePda = this.votePda(hashPda, voter);
    // @ts-ignore
    if (this.program.account.voteInfo.fetchNullable) {
      // @ts-ignore
      return this.program.account.voteInfo.fetchNullable(votePda);
    }
    try {
      return await this.program.account.voteInfo.fetch(votePda);
    } catch (_) {
      return null;
    }
  }
}
