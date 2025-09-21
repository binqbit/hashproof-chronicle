import * as anchor from "@coral-xyz/anchor";
import type { Program, Idl } from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import { HashTimestamp } from "../types/hash_timestamp";
import { PROGRAM_ID } from "./hashTimestamp";

// Anchor IDL describing the deployed HashTimestamp program
const IDL: any = {
  version: "1.0.0",
  name: "hashTimestamp",
  instructions: [
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
      accounts: [
        { name: "hashAccount", isMut: false, isSigner: false }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    },
    {
      name: "vote",
      accounts: [
        { name: "hashAccount", isMut: true, isSigner: false },
        { name: "voteInfo", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    }
  ],
  accounts: [
    {
      name: "hashAccount",
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
      name: "voteInfo", 
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
  errors: [
    { code: 6000, name: "hashNotFound", msg: "Hash not found" },
    { code: 6001, name: "invalidHashSeeds", msg: "Invalid hash PDA seeds" },
    { code: 6002, name: "alreadyVoted", msg: "Already voted for this hash" },
    { code: 6003, name: "notVoter", msg: "Caller is not the voter" },
    { code: 6004, name: "votesNotZero", msg: "Votes are not zero" }
  ]
};

export function createProgram(connection: Connection, wallet: any): Program<HashTimestamp> {
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new anchor.Program(IDL, PROGRAM_ID, provider) as Program<HashTimestamp>;
}
