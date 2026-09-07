import { describe, expect, it, vi } from "vitest";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  resolveLiveRecord,
  resolveMembers,
  resolveRecord,
} from "../../src/contract/records";
import {
  checkAggregate,
  checkBranch,
} from "../../src/features/records/preflight";
import { entryId } from "../../src/features/history/collect-proof";
import {
  branchEntry,
  bytes,
  hashEntry,
  recordFixture,
} from "./fixtures/records";

describe("Canonical ID / PDA resolution", () => {
  it("resolves both formats to the same verified live record", async () => {
    const f = recordFixture();
    const entry = hashEntry();
    const pda = await f.put(entry);
    const byId = await resolveLiveRecord(
      f.client,
      ` ${entryId(entry).toUpperCase()} `,
    );
    const byPda = await resolveLiveRecord(f.client, pda.toBase58());
    expect(byId).toEqual(byPda);
    expect(byId.id).toBe(entryId(entry));
    const base58Id = new PublicKey(
      Buffer.from(entryId(entry), "hex"),
    ).toBase58();
    for (const value of [
      base58Id,
      `id:${base58Id}`,
      `id:${entryId(entry)}`,
      `pda:${pda}`,
      `pda:${pda.toBuffer().toString("hex")}`,
    ]) {
      expect(await resolveLiveRecord(f.client, value)).toEqual(byId);
    }
  });
  it("distinguishes missing canonical records from non-invertible closed PDAs", async () => {
    const f = recordFixture();
    const id = entryId(hashEntry());
    expect((await resolveRecord(f.client, id)).account).toBeNull();
    const base58Id = new PublicKey(Buffer.from(id, "hex")).toBase58();
    expect(await resolveRecord(f.client, `id:${base58Id}`)).toEqual(
      await resolveRecord(f.client, id),
    );
    await expect(resolveRecord(f.client, base58Id)).rejects.toThrow("use id:");
    await expect(
      resolveRecord(f.client, f.client.hashPda(id).toBase58()),
    ).rejects.toThrow("closed PDA");
    await expect(resolveLiveRecord(f.client, id)).rejects.toThrow("not live");
  });
  it("allows a prefunded empty system account as a vacant destination", async () => {
    const f = recordFixture();
    const id = entryId(hashEntry());
    f.records.set(f.client.hashPda(id).toBase58(), {
      owner: SystemProgram.programId,
      executable: false,
      lamports: 10,
      data: Buffer.alloc(0),
    });
    expect((await resolveRecord(f.client, id)).account).toBeNull();
  });
  it("rejects foreign owners, executable accounts, wrong types and mismatched PDAs", async () => {
    const f = recordFixture();
    const entry = hashEntry();
    const pda = await f.put(entry);
    const info = f.records.get(pda.toBase58())!;
    for (const change of [
      { owner: PublicKey.default },
      { executable: true },
      { data: Buffer.alloc(100) },
    ]) {
      f.records.set(pda.toBase58(), { ...info, ...change });
      await expect(resolveRecord(f.client, pda.toBase58())).rejects.toThrow();
    }
    await f.put(hashEntry(9), pda);
    await expect(resolveRecord(f.client, pda.toBase58())).rejects.toThrow(
      "does not match",
    );
  });
  it("does not disguise RPC errors as missing records", async () => {
    const f = recordFixture();
    f.read.mockRejectedValue(new Error("RPC unavailable"));
    await expect(resolveRecord(f.client, entryId(hashEntry()))).rejects.toThrow(
      "RPC unavailable",
    );
  });
  it("rejects two valid Base58 interpretations until the user specifies a type", async () => {
    const f = recordFixture();
    const first = hashEntry(1),
      second = hashEntry(2);
    const secondId = entryId(second);
    const sharedValue = new PublicKey(Buffer.from(secondId, "hex"));
    const secondPda = f.client.hashPda(secondId);
    const original = f.client.hashPda.bind(f.client);
    // Deliberately force this otherwise cryptographically unlikely address relationship.
    vi.spyOn(f.client, "hashPda").mockImplementation((id) =>
      typeof id === "string" && id === entryId(first)
        ? sharedValue
        : original(id),
    );
    await f.put(first);
    await f.put(second);
    await expect(
      resolveRecord(f.client, sharedValue.toBase58()),
    ).rejects.toThrow("Ambiguous");
    expect((await resolveRecord(f.client, `pda:${sharedValue}`)).id).toBe(
      entryId(first),
    );
    expect((await resolveRecord(f.client, `id:${sharedValue}`)).pda).toEqual(
      secondPda,
    );
  });
  it("does not hide a candidate RPC failure behind another live interpretation", async () => {
    const f = recordFixture(),
      entry = hashEntry();
    const pda = await f.put(entry);
    f.read.mockImplementation(async (key) => {
      if (key.equals(pda)) return f.records.get(pda.toBase58())!;
      throw new Error("RPC unavailable");
    });
    await expect(resolveRecord(f.client, pda.toBase58())).rejects.toThrow(
      "RPC unavailable",
    );
  });
  it("does not let a foreign direct address mask a valid Base58 canonical ID", async () => {
    const f = recordFixture(),
      entry = hashEntry();
    const pda = await f.put(entry);
    const id = entryId(entry);
    const base58Id = new PublicKey(Buffer.from(id, "hex")).toBase58();
    f.records.set(base58Id, {
      ...f.records.get(pda.toBase58())!,
      owner: PublicKey.default,
    });
    expect((await resolveRecord(f.client, base58Id)).id).toBe(id);
  });
  it("preserves mixed member order and detects duplicate aliases", async () => {
    const f = recordFixture();
    const first = hashEntry(1),
      second = hashEntry(2);
    const pda = await f.put(first);
    await f.put(second);
    expect(
      (await resolveMembers(f.client, `${entryId(second)},\n${pda}`)).map(
        (r) => r.id,
      ),
    ).toEqual([entryId(second), entryId(first)]);
    await expect(
      resolveMembers(f.client, `${entryId(first)},${pda}`),
    ).rejects.toThrow("same record");
    await expect(
      resolveMembers(
        f.client,
        `${entryId(first)},${new PublicKey(
          Buffer.from(entryId(first), "hex"),
        )}`,
      ),
    ).rejects.toThrow("same record");
    await expect(resolveMembers(f.client, "")).rejects.toThrow("at least one");
    await expect(
      resolveMembers(f.client, Array(33).fill(entryId(first)).join("\n")),
    ).rejects.toThrow("32 members");
  });
});

describe("Creation previews", () => {
  it("checks a parent PDA and rejects an occupied branch destination", async () => {
    const f = recordFixture(),
      parent = hashEntry();
    const pda = await f.put(parent);
    const child = branchEntry(parent);
    expect(
      (await checkBranch(f.client, pda.toBase58(), bytes(2), false)).id,
    ).toBe(entryId(child));
    await f.put(child);
    await expect(
      checkBranch(f.client, entryId(parent), bytes(2), false),
    ).rejects.toThrow("already exists");
  });
  it("checks withdrawal ownership only when requested", async () => {
    const f = recordFixture(),
      parent = hashEntry();
    await f.put(parent);
    const votes = vi.spyOn(f.client, "fetchVoteInfo").mockResolvedValue(null);
    await expect(
      checkBranch(f.client, entryId(parent), bytes(2), true),
    ).rejects.toThrow("Connect your wallet");
    await expect(
      checkBranch(f.client, entryId(parent), bytes(2), true, PublicKey.default),
    ).rejects.toThrow("no parent vote");
    await checkBranch(f.client, entryId(parent), bytes(2), false);
    expect(votes).toHaveBeenCalledTimes(1);
  });
  it("previews distinct batch/pack identities without signing", async () => {
    const f = recordFixture(),
      entry = hashEntry();
    const pda = await f.put(entry);
    const batch = await checkAggregate(f.client, "batch", pda.toBase58());
    const pack = await checkAggregate(f.client, "pack", entryId(entry));
    expect(batch.id).not.toBe(pack.id);
    expect(batch.members[0].id).toBe(entryId(entry));
  });
});
