// HashTimestamp program type definitions
// This would normally be generated from the Anchor IDL but we'll create a simplified version

import { PublicKey } from '@solana/web3.js';
import { Idl, IdlAccounts } from '@coral-xyz/anchor';

// Program IDL structure
export interface HashTimestamp extends Idl {
  version: "0.1.0";
  name: "hash_timestamp";
  instructions: [
    {
      name: "vote";
      accounts: [
        {
          name: "hashAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "voteInfo";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "hash";
          type: {
            array: ["u8", 32];
          };
        }
      ];
    },
    {
      name: "unvote";
      accounts: [
        {
          name: "hashAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "voteInfo";
          isMut: true;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "hash";
          type: {
            array: ["u8", 32];
          };
        }
      ];
    },
    {
      name: "verify";
      accounts: [
        {
          name: "hashAccount";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "hash";
          type: {
            array: ["u8", 32];
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "HashAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "hash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "voters";
            type: "u64";
          },
          {
            name: "createdAt";
            type: "i64";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "VoteInfo";
      type: {
        kind: "struct";
        fields: [
          {
            name: "voter";
            type: "publicKey";
          },
          {
            name: "hash";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    }
  ];
  types: [];
  events: [];
  errors: [];
}

// Account types
export type HashAccount = IdlAccounts<HashTimestamp>["HashAccount"];
export type VoteInfo = IdlAccounts<HashTimestamp>["VoteInfo"];