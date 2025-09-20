// Simple type definition for the HashTimestamp IDL  
export type HashTimestamp = any;

// Account types extracted from the IDL
export type HashAccount = {
  hash: number[];
  voters: bigint;
  createdAt: bigint;
  bump: number;
};

export type VoteInfo = {
  voter: string;
  hash: number[];
  amount: bigint;
  bump: number;
};