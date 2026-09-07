import { sha256 } from "@noble/hashes/sha256";
import { Buffer } from "buffer";

/** The existing SDK only uses this synchronous SHA-256 subset of Node crypto. */
export function createHash(algorithm: string) {
  if (algorithm !== "sha256")
    throw new Error(`Unsupported SDK hash algorithm: ${algorithm}`);
  const hash = sha256.create();
  return {
    update(data: Uint8Array) {
      hash.update(data);
      return this;
    },
    digest() {
      return Buffer.from(hash.digest());
    },
  };
}
