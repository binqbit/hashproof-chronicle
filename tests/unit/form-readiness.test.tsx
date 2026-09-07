// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AggregatePanel } from "../../src/features/records/AggregatePanel";
import { BranchPanel } from "../../src/features/records/BranchPanel";
import { AccountPanel } from "../../src/features/records/AccountPanel";
import { RecordPanel } from "../../src/features/records/RecordPanel";
import { RegisterPanel } from "../../src/features/records/RegisterPanel";
import { RestorePanel } from "../../src/features/history/RestorePanel";
import type { SelectField } from "../../src/components/SelectField";
import type { ComponentProps } from "react";

const state = vi.hoisted(() => ({
  busy: false,
  client: {},
  checkAggregate: vi.fn(),
  checkBranch: vi.fn(),
  checkRestore: vi.fn(),
  resolveRecord: vi.fn(),
}));
vi.mock("../../src/contract/network", () => ({
  useNetwork: () => ({
    network: { endpoint: "http://127.0.0.1:8899" },
    busy: state.busy,
  }),
}));
vi.mock("../../src/features/workspace/use-contract", () => ({
  useContract: () => ({ client: state.client }),
}));
vi.mock("../../src/features/records/preflight", () => ({
  checkAggregate: state.checkAggregate,
  checkBranch: state.checkBranch,
}));
vi.mock("../../src/features/history/check-restore", () => ({
  checkRestore: state.checkRestore,
}));
vi.mock("../../src/contract/records", () => ({
  resolveRecord: state.resolveRecord,
}));
// Form readiness is independent of Radix's pointer/layout APIs. The themed
// dropdown and manual-mode switch are covered in the real-browser suite.
vi.mock("../../src/components/SelectField", () => ({
  SelectField: ({
    id,
    label,
    value,
    options,
    disabled,
    onChange,
  }: ComponentProps<typeof SelectField>) => (
    <select
      id={id}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

beforeEach(() => {
  // Align jsdom's realm with the Node Buffers hashed by the real SDK.
  vi.stubGlobal(
    "Uint8Array",
    Object.getPrototypeOf(Buffer.prototype).constructor,
  );
  state.busy = false;
  state.checkAggregate.mockResolvedValue(undefined);
  state.checkBranch.mockResolvedValue(undefined);
  state.checkRestore.mockResolvedValue({ nodes: [], errors: [], warnings: [] });
  state.resolveRecord.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const props = () => ({
  disabled: false,
  selected: "",
  history: [],
  run: vi.fn().mockResolvedValue(undefined),
});
const button = (name: string | RegExp) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const proof = JSON.stringify([
  { hash: "ab".repeat(32), source: { kind: "hash" }, createdAt: "100" },
]);

async function manualMembers(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Choose records using" }),
    "manual",
  );
}

it("blocks empty and separator-only aggregate checks/submissions, then re-enables with members", async () => {
  const operation = props();
  const user = userEvent.setup();
  render(<AggregatePanel {...operation} />);
  await manualMembers(user);
  for (const input of ["", " \n\t", " , ,\n "]) {
    fill("Ordered canonical IDs or PDAs", input);
    expect(button("Check members & preview — no fee").disabled).toBe(true);
    expect(button("Create batch + first vote").disabled).toBe(true);
    fireEvent.submit(button("Create batch + first vote").closest("form")!);
  }
  expect(operation.run).not.toHaveBeenCalled();
  expect(state.checkAggregate).not.toHaveBeenCalled();
  fill("Ordered canonical IDs or PDAs", "ab".repeat(32));
  expect(button("Create batch + first vote").disabled).toBe(false);
  await user.click(button("Check members & preview — no fee"));
  expect(state.checkAggregate).toHaveBeenCalledOnce();
  await user.click(button("Create batch + first vote"));
  expect(operation.run).toHaveBeenCalledOnce();
  fill("Ordered canonical IDs or PDAs", "");
  expect(button("Create batch + first vote").disabled).toBe(true);
});

it("requires both branch fields, including after clearing a previously entered digest", async () => {
  const operation = props();
  const user = userEvent.setup();
  render(<BranchPanel {...operation} />);
  for (const [parent, payload] of [
    ["", ""],
    [" ", "ab".repeat(32)],
    ["ab".repeat(32), " \t"],
  ]) {
    fill("Parent canonical ID or PDA", parent);
    fill("New payload / file digest", payload);
    expect(button("Check parent & preview — no fee").disabled).toBe(true);
    expect(button("Create branch + first vote").disabled).toBe(true);
    fireEvent.submit(button("Create branch + first vote").closest("form")!);
  }
  expect(operation.run).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
  fill("New payload / file digest", "cd".repeat(32));
  expect(button("Create branch + first vote").disabled).toBe(false);
  await user.click(button("Check parent & preview — no fee"));
  expect(state.checkBranch).toHaveBeenCalledOnce();
  fill("New payload / file digest", "");
  expect(button("Create branch + first vote").disabled).toBe(true);
});

it("blocks an empty account form even when the transaction callback is invoked via form submission", async () => {
  const operation = props();
  const user = userEvent.setup();
  const view = render(<AccountPanel {...operation} />);
  for (const value of ["", "   "]) {
    fill("Target Solana account address", value);
    expect(button("Commit snapshot + first vote").disabled).toBe(true);
    fireEvent.submit(button("Commit snapshot + first vote").closest("form")!);
  }
  expect(operation.run).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
  fill("Target Solana account address", "ab".repeat(32));
  expect(button("Commit snapshot + first vote").disabled).toBe(false);
  await user.click(button("Commit snapshot + first vote"));
  expect(operation.run).toHaveBeenCalledOnce();
  view.rerender(<AccountPanel {...operation} disabled />);
  expect(button("Commit snapshot + first vote").disabled).toBe(true);
});

it("does not start an Inspect lookup until there is non-whitespace input", async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RecordPanel
        {...props()}
        onSelect={vi.fn()}
        onProof={vi.fn()}
        onAction={vi.fn()}
      />
    </QueryClientProvider>,
  );
  for (const value of ["", "   "]) {
    fill("Canonical ID or account PDA", value);
    expect(button("Look up").disabled).toBe(true);
    fireEvent.submit(button("Look up").closest("form")!);
  }
  expect(state.resolveRecord).not.toHaveBeenCalled();
  fill("Canonical ID or account PDA", "ab".repeat(32));
  await user.click(button("Look up"));
  expect(state.resolveRecord).toHaveBeenCalledOnce();
});

it("keeps Timestamp empty-input checks consistent between the button and submit handler", () => {
  const onRegister = vi.fn();
  render(
    <RegisterPanel
      disabled={false}
      onRegister={onRegister}
      onInspect={vi.fn()}
    />,
  );
  fill("Raw SHA-256 / 32-byte value", "   ");
  expect(button("Register + first vote").disabled).toBe(true);
  expect(button("Inspect record — no fee").disabled).toBe(true);
  fireEvent.submit(button("Register + first vote").closest("form")!);
  expect(onRegister).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("blocks whitespace Restore input and invalidates ready actions when input is cleared", async () => {
  const user = userEvent.setup();
  const onHistory = vi.fn();
  render(<RestorePanel {...props()} onHistory={onHistory} />);
  for (const value of ["", " \n\t"]) {
    fill("Proof chain JSON", value);
    expect(button("Check format & load history").disabled).toBe(true);
    await user.click(button("Check format & load history"));
  }
  expect(onHistory).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
  fill("Proof chain JSON", proof);
  await user.click(button("Check format & load history"));
  expect(button("Validate proof on-chain — fee").disabled).toBe(true);
  await user.click(button("Check proof & live state — no fee"));
  expect(button("Validate proof on-chain — fee").disabled).toBe(false);
  fill("Proof chain JSON", "");
  expect(button("Check format & load history").disabled).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Validate proof on-chain — fee" }),
  ).toBeNull();
});

it("disables Restore parsing during a replacement file read and ignores stale file completion after manual input", async () => {
  const user = userEvent.setup();
  render(<RestorePanel {...props()} onHistory={vi.fn()} />);
  fill("Proof chain JSON", proof);
  await user.click(button("Check format & load history"));
  await user.click(button("Check proof & live state — no fee"));
  let finish!: (contents: string) => void;
  const file = new File([proof], "replacement.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  await user.upload(screen.getByLabelText("Import proof JSON"), file);
  expect(button("Reading proof file…").disabled).toBe(true);
  expect(
    (screen.getByLabelText("Proof chain JSON") as HTMLTextAreaElement).value,
  ).toBe("");
  fill("Proof chain JSON", proof);
  expect(button("Check format & load history").disabled).toBe(false);
  await act(async () => finish("stale file contents"));
  expect(
    (screen.getByLabelText("Proof chain JSON") as HTMLTextAreaElement).value,
  ).toBe(proof);
  await user.click(button("Check format & load history"));
  expect(button("Validate proof on-chain — fee").disabled).toBe(true);
});

it("keeps populated aggregate actions locked while a check or transaction is pending", async () => {
  const user = userEvent.setup();
  const operation = props();
  let finish!: () => void;
  state.checkAggregate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<AggregatePanel {...operation} />);
  await manualMembers(user);
  fill("Ordered canonical IDs or PDAs", "ab".repeat(32));
  await user.click(button("Check members & preview — no fee"));
  expect(button("Create batch + first vote").disabled).toBe(true);
  fireEvent.submit(button("Create batch + first vote").closest("form")!);
  expect(operation.run).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(button("Create batch + first vote").disabled).toBe(false);
  state.busy = true;
  view.rerender(<AggregatePanel {...operation} />);
  expect(button("Create batch + first vote").disabled).toBe(true);
  expect(button("Check members & preview — no fee").disabled).toBe(true);
});

it("does not offer a stale Restore payload after a replacement file fails to read", async () => {
  const user = userEvent.setup();
  render(<RestorePanel {...props()} onHistory={vi.fn()} />);
  fill("Proof chain JSON", proof);
  await user.click(button("Check format & load history"));
  const file = new File([proof], "broken.json", { type: "application/json" });
  Object.defineProperty(file, "text", {
    value: vi.fn().mockRejectedValue(new Error("File read failed")),
  });
  await user.upload(screen.getByLabelText("Import proof JSON"), file);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("File read failed"),
  );
  expect(button("Check format & load history").disabled).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Validate proof on-chain — fee" }),
  ).toBeNull();
});
