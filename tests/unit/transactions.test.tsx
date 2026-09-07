// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { NetworkProvider, useNetwork } from "../../src/contract/network";
import { useTransaction } from "../../src/features/workspace/use-contract";
import type { Receipt } from "../../src/features/workspace/operations";
import { ArchiveCaptureError } from "../../src/contract/sdk";

const adapter = vi.hoisted(() => ({
  wallet: undefined as AnchorProvider["wallet"] | undefined,
  connection: undefined as Connection | undefined,
}));
vi.mock("@solana/wallet-adapter-react", () => ({
  useAnchorWallet: () => adapter.wallet,
  useConnection: () => ({ connection: adapter.connection }),
}));
afterEach(cleanup);

function fixture(connected = true, deployed = true) {
  adapter.connection = new Connection("http://127.0.0.1:8899");
  vi.spyOn(adapter.connection, "getAccountInfo").mockResolvedValue(
    deployed
      ? {
          executable: true,
          owner: PublicKey.default,
          lamports: 1,
          data: Buffer.alloc(0),
        }
      : null
  );
  adapter.wallet = connected
    ? {
        publicKey: PublicKey.default,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      }
    : undefined;
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const confirmed = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>
      <NetworkProvider>{children}</NetworkProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(
    () => ({ transaction: useTransaction(confirmed), network: useNetwork() }),
    { wrapper }
  );
  return { ...hook, confirmed };
}

describe("Wallet transaction boundary", () => {
  for (const status of ["confirmed", "submitted"] as const) {
    it(`retains ${status} archive capture status without inviting duplicate creation`, async () => {
      const f = fixture();
      const error = new ArchiveCaptureError(
        "known-signature",
        PublicKey.default.toBase58(),
        { hash: "ab".repeat(32), source: { kind: "hash" } },
        new Error("RPC offline"),
        status
      );
      await act(() =>
        f.result.current.transaction.run("Register", async () => {
          throw error;
        })
      );
      expect(f.result.current.network.busy).toBe(false);
      if (status === "confirmed") {
        expect(f.confirmed).toHaveBeenCalledWith(
          expect.objectContaining({
            signature: "known-signature",
            warning: expect.stringContaining("Do not repeat creation"),
          })
        );
      } else {
        expect(f.confirmed).not.toHaveBeenCalled();
        expect(f.result.current.transaction.error).toContain("known-signature");
      }
    });
  }
  it("never invokes an operation without a signing wallet or deployed program", async () => {
    const action = vi.fn();
    const disconnected = fixture(false);
    await act(() =>
      disconnected.result.current.transaction.run("Register", action)
    );
    expect(action).not.toHaveBeenCalled();
    expect(disconnected.result.current.transaction.error).toContain(
      "Connect a wallet"
    );
    disconnected.unmount();
    const missing = fixture(true, false);
    await act(() => missing.result.current.transaction.run("Register", action));
    expect(action).not.toHaveBeenCalled();
    expect(missing.result.current.transaction.error).toContain("not deployed");
  });
  it("prevents duplicate submissions and network changes until confirmation", async () => {
    const f = fixture();
    let finish!: (receipt: Receipt) => void;
    const pending = new Promise<Receipt>((resolve) => {
      finish = resolve;
    });
    const action = vi.fn(() => pending);
    let submission!: Promise<void>;
    await act(async () => {
      submission = f.result.current.transaction.run("Register", action);
    });
    expect(f.result.current.network.busy).toBe(true);
    await act(async () => {
      await f.result.current.transaction.run("Register", action);
      f.result.current.network.setNetwork("devnet");
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(f.result.current.network.network.key).toBe("localnet");
    await act(async () => {
      finish({ signature: "confirmed", ids: [] });
      await submission;
    });
    expect(f.confirmed).toHaveBeenCalledWith({
      signature: "confirmed",
      ids: [],
    });
    expect(f.result.current.network.busy).toBe(false);
  });
  it("releases the lock after rejection and warns against blind timeout retries", async () => {
    const f = fixture();
    await act(() =>
      f.result.current.transaction.run("Register", async () => {
        throw new Error("Confirmation timed out");
      })
    );
    expect(f.result.current.network.busy).toBe(false);
    expect(f.confirmed).not.toHaveBeenCalled();
    expect(f.result.current.transaction.error).toContain("may have landed");
  });
});
