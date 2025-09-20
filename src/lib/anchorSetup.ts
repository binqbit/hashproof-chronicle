import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { HashTimestamp } from "../types/hash_timestamp";
import { PROGRAM_ID } from "./hashTimestamp";

// Real IDL for the HashTimestamp program - casting to any to avoid complex type matching
const IDL = {
  version: "1.0.0",
  name: "hashTimestamp",
  instructions: [
    {
      name: "unvote",
      discriminator: [181, 169, 220, 24, 207, 114, 148, 223],
      accounts: [
        {
          name: "hashAccount",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [104, 97, 115, 104] },
              { kind: "arg", path: "hash" }
            ]
          }
        },
        {
          name: "voteInfo",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [118, 111, 116, 101] },
              { kind: "account", path: "hashAccount" },
              { kind: "account", path: "user" }
            ]
          }
        },
        { name: "user", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    },
    {
      name: "verify",
      discriminator: [133, 161, 141, 48, 120, 198, 88, 150],
      accounts: [
        {
          name: "hashAccount",
          pda: {
            seeds: [
              { kind: "const", value: [104, 97, 115, 104] },
              { kind: "arg", path: "hash" }
            ]
          }
        }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    },
    {
      name: "vote",
      discriminator: [227, 110, 155, 23, 136, 126, 172, 25],
      accounts: [
        {
          name: "hashAccount",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [104, 97, 115, 104] },
              { kind: "arg", path: "hash" }
            ]
          }
        },
        {
          name: "voteInfo",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [118, 111, 116, 101] },
              { kind: "account", path: "hashAccount" },
              { kind: "account", path: "user" }
            ]
          }
        },
        { name: "user", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    }
  ],
  accounts: [
    { name: "hashAccount", discriminator: [14, 115, 101, 24, 84, 2, 196, 212] },
    { name: "voteInfo", discriminator: [53, 111, 174, 160, 168, 16, 248, 186] }
  ],
  errors: [
    { code: 6000, name: "hashNotFound", msg: "Hash not found" },
    { code: 6001, name: "invalidHashSeeds", msg: "Invalid hash PDA seeds" },
    { code: 6002, name: "alreadyVoted", msg: "Already voted for this hash" },
    { code: 6003, name: "notVoter", msg: "Caller is not the voter" },
    { code: 6004, name: "votesNotZero", msg: "Votes are not zero" }
  ],
  types: [
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
          { name: "voter", type: "pubkey" },
          { name: "hash", type: { array: ["u8", 32] } },
          { name: "amount", type: "u64" },
          { name: "bump", type: "u8" }
        ]
      }
    }
  ]
} as any;

export function createProgram(connection: Connection, wallet: any): Program<HashTimestamp> {
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  
  return new anchor.Program(IDL as Idl, PROGRAM_ID, provider) as Program<HashTimestamp>;
}