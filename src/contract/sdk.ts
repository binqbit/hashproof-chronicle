/** One application entrypoint into the synchronized upstream SDK. No protocol implementation here. */
export * from "../generated/hash-timestamp/app/sdk/hashTimestamp";
export { prepareRestore } from "../generated/hash-timestamp/app/sdk/restore";
export { numberToU64 as rpcU64 } from "../generated/hash-timestamp/app/sdk/protocol/normalization";
export { accountPublicKey } from "../generated/hash-timestamp/app/sdk/protocol/normalization";
export { IDL } from "../generated/hash-timestamp/target/types/hash_timestamp";
export type { HashTimestamp } from "../generated/hash-timestamp/target/types/hash_timestamp";
