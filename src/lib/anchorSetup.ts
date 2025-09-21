import * as anchor from "@coral-xyz/anchor";
import type { Program, Idl } from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { HashTimestamp } from "../types/hash_timestamp";
import { PROGRAM_ID } from "./hashTimestamp";

// Anchor IDL describing the deployed HashTimestamp program
const IDL: Idl = {
  version: "1.0.0",
  name: "hashTimestamp",
  instructions: [
    {
      name: "unvote",
      accounts: [
        {
          name: "hashAccount",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              { kind: "const", value: [104, 97, 115, 104] },
              { kind: "arg", path: "hash" }
            ]
          }
        },
        {
          name: "voteInfo",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              { kind: "const", value: [118, 111, 116, 101] },
              { kind: "account", path: "hashAccount" },
              { kind: "account", path: "user" }
            ]
          }
        },
        { name: "user", isMut: true, isSigner: true },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
          address: "11111111111111111111111111111111"
        }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    },
    {
      name: "verify",
      accounts: [
        {
          name: "hashAccount",
          isMut: false,
          isSigner: false,
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
      accounts: [
        {
          name: "hashAccount",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              { kind: "const", value: [104, 97, 115, 104] },
              { kind: "arg", path: "hash" }
            ]
          }
        },
        {
          name: "voteInfo",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              { kind: "const", value: [118, 111, 116, 101] },
              { kind: "account", path: "hashAccount" },
              { kind: "account", path: "user" }
            ]
          }
        },
        { name: "user", isMut: true, isSigner: true },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
          address: "11111111111111111111111111111111"
        }
      ],
      args: [{ name: "hash", type: { array: ["u8", 32] } }]
    }
  ],
  accounts: [
    {
      name: "hashAccount",
      discriminator: [14, 115, 101, 24, 84, 2, 196, 212],
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
      discriminator: [53, 111, 174, 160, 168, 16, 248, 186],
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

function ensureAnchorWallet(adapter: WalletAdapter): anchor.Wallet {
  if (!adapter.publicKey) {
    throw new Error("Wallet must be connected before creating the Anchor provider");
  }

  if (!adapter.signTransaction || !adapter.signAllTransactions) {
    throw new Error("Connected wallet does not support required signing methods");
  }

  return {
    publicKey: adapter.publicKey,
    signTransaction: adapter.signTransaction.bind(adapter),
    signAllTransactions: adapter.signAllTransactions.bind(adapter),
  };
}

export function createProgram(connection: Connection, adapter: WalletAdapter): Program<HashTimestamp> {
  const wallet = ensureAnchorWallet(adapter);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new anchor.Program(IDL, PROGRAM_ID, provider) as Program<HashTimestamp>;
}
