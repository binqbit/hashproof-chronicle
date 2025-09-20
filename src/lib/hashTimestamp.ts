// Mock implementation of the HashTimestamp SDK
// In a real implementation, this would use the actual Anchor SDK

import { PublicKey, Connection, Keypair } from '@solana/web3.js';

// Mock data structure matching the real HashTimestamp account
export interface HashAccount {
  hash: Uint8Array;
  voters: number;
  createdAt: number;
  bump: number;
}

export interface VoteInfo {
  voter: PublicKey;
  hash: Uint8Array;
  amount: number;
  bump: number;
}

// Mock program ID - in real implementation this would be from the deployed program
export const PROGRAM_ID = new PublicKey('HTSx1VNWNBDGtfwr2nU8gSzhxfFtUxd2nkdFq7SCSZzY');

export const HASH_ACCOUNT_SPACE = 64; // 8 + 32 + 8 + 8 + 1 + 7 padding

export function to32Bytes(input: Uint8Array | Buffer | number[] | string): Uint8Array {
  let buf: Buffer;
  if (input instanceof Uint8Array) {
    buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  } else if (Buffer.isBuffer(input)) {
    buf = input;
  } else if (Array.isArray(input)) {
    buf = Buffer.from(input);
  } else {
    buf = Buffer.from(input, 'hex');
  }
  if (buf.length !== 32) throw new Error('hash must be exactly 32 bytes');
  return new Uint8Array(buf);
}

export function deriveHashPda(programId: PublicKey, hash: Uint8Array): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('hash'), Buffer.from(hash)],
    programId
  );
  return pda;
}

export function deriveVotePda(programId: PublicKey, hashPda: PublicKey, voter: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vote'), hashPda.toBuffer(), voter.toBuffer()],
    programId
  );
  return pda;
}

export async function rentExemptForHash(connection: Connection): Promise<number> {
  return connection.getMinimumBalanceForRentExemption(HASH_ACCOUNT_SPACE);
}

// Mock HashTimestamp client for demonstration
export class HashTimestampClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection, programId: PublicKey = PROGRAM_ID) {
    this.connection = connection;
    this.programId = programId;
  }

  hashPda(hash: Uint8Array): PublicKey {
    return deriveHashPda(this.programId, hash);
  }

  votePda(hashPda: PublicKey, voter: PublicKey): PublicKey {
    return deriveVotePda(this.programId, hashPda, voter);
  }

  // Mock implementation - in real app this would call the actual program
  async vote(hash: Uint8Array): Promise<string> {
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 1000));
    return 'mock_signature_' + Date.now();
  }

  async unvote(hash: Uint8Array): Promise<string> {
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 1000));
    return 'mock_signature_' + Date.now();
  }

  async verify(hash: Uint8Array): Promise<string> {
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 500));
    return 'mock_signature_' + Date.now();
  }

  // Mock data - in real implementation this would fetch from chain
  async fetchHashAccount(hash: Uint8Array): Promise<HashAccount | null> {
    // Simulate some hashes existing
    const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Create deterministic mock data based on hash
    if (hashHex.startsWith('a') || hashHex.startsWith('b') || hashHex.startsWith('c')) {
      return {
        hash,
        voters: Math.floor(Math.random() * 5) + 1,
        createdAt: Date.now() / 1000 - Math.floor(Math.random() * 86400 * 30), // Random time in last 30 days
        bump: 255,
      };
    }
    
    return null;
  }

  async fetchVoteInfo(hash: Uint8Array, voter: PublicKey): Promise<VoteInfo | null> {
    // Mock implementation - randomly return vote info
    const account = await this.fetchHashAccount(hash);
    if (account && Math.random() > 0.5) {
      const rentAmount = await rentExemptForHash(this.connection);
      return {
        voter,
        hash,
        amount: rentAmount,
        bump: 255,
      };
    }
    return null;
  }
}