// Anchor program setup and initialization
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { HashTimestamp } from "../types/hash_timestamp";
import { PROGRAM_ID } from "./hashTimestamp";

// Mock IDL for the HashTimestamp program
const IDL: HashTimestamp = {
  version: "0.1.0",
  name: "hash_timestamp",
  instructions: [
    {
      name: "vote",
      accounts: [
        { name: "hashAccount", isMut: true, isSigner: false },
        { name: "voteInfo", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    },
    {
      name: "unvote", 
      accounts: [
        { name: "hashAccount", isMut: true, isSigner: false },
        { name: "voteInfo", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    },
    {
      name: "verify",
      accounts: [{ name: "hashAccount", isMut: false, isSigner: false }],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    }
  ],
  accounts: [
    {
      name: "HashAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "hash", type: { array: ["u8", 32] } },
          { name: "voters", type: "u64" },
          { name: "createdAt", type: "i64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "VoteInfo", 
      type: {
        kind: "struct",
        fields: [
          { name: "voter", type: "publicKey" },
          { name: "hash", type: { array: ["u8", 32] } },
          { name: "amount", type: "u64" },
          { name: "bump", type: "u8" }
        ]
      }
    }
  ],
  types: [],
  events: [],
  errors: []
};

export function createProgram(connection: Connection, wallet: any): Program<HashTimestamp> {
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  
  return new anchor.Program(IDL, PROGRAM_ID, provider);
}