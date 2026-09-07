// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { useCheck } from "../../src/features/workspace/use-check";
import { WalletControls } from "../../src/components/WalletControls";

const state = vi.hoisted(() => ({
  busy: false,
  disconnect: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    wallet: {},
    connected: true,
    connecting: false,
    disconnecting: false,
    disconnect: state.disconnect,
    select: state.select,
  }),
}));
vi.mock("@solana/wallet-adapter-react-ui", () => ({
  WalletMultiButton: () => <button>Select wallet</button>,
}));
vi.mock("../../src/contract/network", () => ({
  useNetwork: () => ({ busy: state.busy }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.busy = false;
});

it("invalidates successful checks and ignores late results after input changes", async () => {
  const hook = renderHook(({ key }) => useCheck<string>(key), {
    initialProps: { key: "first" },
  });
  let finish!: (value: string) => void;
  let request!: Promise<string | undefined>;
  await act(async () => {
    request = hook.result.current.run(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  });
  hook.rerender({ key: "second" });
  await act(async () => {
    finish("stale");
    await request;
  });
  expect(hook.result.current.value).toBeUndefined();
  await act(() => hook.result.current.run(async () => "fresh"));
  expect(hook.result.current.value).toBe("fresh");
  hook.rerender({ key: "third" });
  expect(hook.result.current.value).toBeUndefined();
  hook.rerender({ key: "second" });
  expect(hook.result.current.value).toBeUndefined();
});

it("disconnects and forgets the wallet selection", async () => {
  state.disconnect.mockResolvedValue(undefined);
  render(<WalletControls />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Disconnect wallet" }));
  });
  expect(state.disconnect).toHaveBeenCalledOnce();
  expect(state.select).toHaveBeenCalledWith(null);
});

it("locks wallet controls during a transaction and reports disconnect failures", async () => {
  state.busy = true;
  const view = render(<WalletControls />);
  expect(
    screen
      .getByRole("button", { name: "Disconnect wallet" })
      .closest("fieldset")?.disabled,
  ).toBe(true);
  state.busy = false;
  state.disconnect.mockRejectedValue(new Error("Wallet refused"));
  view.rerender(<WalletControls />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Disconnect wallet" }));
  });
  expect(screen.getByRole("alert").textContent).toContain("Wallet refused");
  expect(state.select).not.toHaveBeenCalled();
});
