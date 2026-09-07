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
  disconnecting: false,
  disconnect: vi.fn(),
  menuKeyDown: vi.fn(),
}));
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    wallet: {},
    connected: true,
    connecting: false,
    disconnecting: state.disconnecting,
    disconnect: state.disconnect,
  }),
}));
vi.mock("@solana/wallet-adapter-react-ui", () => ({
  WalletMultiButton: () => (
    <div>
      <button>Wallet</button>
      <ul role="menu">
        <li
          role="menuitem"
          onClick={state.disconnect}
          onKeyDown={state.menuKeyDown}
        >
          Disconnect
        </li>
      </ul>
    </div>
  ),
}));
vi.mock("../../src/contract/network", () => ({
  useNetwork: () => ({ busy: state.busy }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.busy = false;
  state.disconnecting = false;
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

it("renders only the Wallet button and delegates disconnect to its menu", () => {
  render(<WalletControls />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Wallet" })).toBeTruthy();
  fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));
  expect(state.disconnect).toHaveBeenCalledOnce();
});

it.each(["busy", "disconnecting"] as const)(
  "locks the wallet button and menu while %s, then unlocks them",
  (lock) => {
    state[lock] = true;
    const view = render(<WalletControls />);
    const button = screen.getByRole("button", { name: "Wallet" });
    const menu = screen.getByRole("menuitem", { name: "Disconnect" });
    expect(button.closest("fieldset")?.disabled).toBe(true);
    fireEvent.click(menu);
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(state.disconnect).not.toHaveBeenCalled();
    expect(state.menuKeyDown).not.toHaveBeenCalled();
    state[lock] = false;
    view.rerender(<WalletControls />);
    expect(button.closest("fieldset")?.disabled).toBe(false);
    fireEvent.click(menu);
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(state.disconnect).toHaveBeenCalledOnce();
    expect(state.menuKeyDown).toHaveBeenCalledOnce();
  },
);
