// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicKey } from "@solana/web3.js";
import { AggregatePanel } from "../../src/features/records/AggregatePanel";
import {
  archiveFromProof,
  IDL,
  stringifyArchive,
  type RestoreProofInput,
} from "../../src/contract/sdk";
import { entryId } from "../../src/features/history/collect-proof";
import { branchEntry, hashEntry } from "./fixtures/records";

const state = vi.hoisted(() => ({
  busy: false,
  client: {},
  check: vi.fn(),
  aggregate: vi.fn(),
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
  checkAggregate: state.check,
}));
vi.mock("../../src/features/workspace/operations", () => ({
  aggregate: state.aggregate,
}));

beforeEach(() => {
  vi.stubGlobal(
    "Uint8Array",
    Object.getPrototypeOf(Buffer.prototype).constructor,
  );
  state.busy = false;
  state.check.mockImplementation(async (_client, _kind, input: string) => ({
    members: input.split("\n").map((id) => ({ id })),
    id: "ab".repeat(32),
    pda: PublicKey.default,
  }));
  state.aggregate.mockResolvedValue({ signature: "mock-signature", ids: [] });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function proofFile(proof: RestoreProofInput[]) {
  const json = stringifyArchive(archiveFromProof(IDL.address, proof));
  const file = new File([json], "history.json", { type: "application/json" });
  Object.defineProperty(file, "text", {
    value: vi.fn().mockResolvedValue(json),
    configurable: true,
  });
  return file;
}
const button = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;
const props = () => ({
  disabled: false,
  selected: "",
  history: [],
  run: vi.fn().mockResolvedValue(undefined),
});

it("selects the whole imported chain by default and retains history when a member is unchecked", async () => {
  const user = userEvent.setup();
  const parent = hashEntry();
  const child = branchEntry(parent);
  const p = props();
  p.run.mockImplementation(async (_label, action) => action(state.client));
  render(<AggregatePanel {...p} />);
  expect(screen.queryByLabelText("Ordered canonical IDs or PDAs")).toBeNull();
  await user.upload(
    screen.getByLabelText("Import group proof files"),
    proofFile([child, parent]),
  );
  expect(button("Create batch + first vote").disabled).toBe(false);
  expect(
    screen
      .getAllByRole("checkbox")
      .every((checkbox) => (checkbox as HTMLInputElement).checked),
  ).toBe(true);
  expect(state.check).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("checkbox", { name: `Select record ${entryId(parent)}` }),
  );
  await user.click(button("Check members & preview — no fee"));
  expect(state.check.mock.calls[0][2]).toBe(entryId(child));
  const history = state.check.mock.calls[0][3] as RestoreProofInput[];
  expect(history.map(entryId).sort()).toEqual(
    [entryId(child), entryId(parent)].sort(),
  );
  await user.click(button("Create batch + first vote"));
  expect(state.aggregate).toHaveBeenCalledWith(
    state.client,
    "batch",
    [entryId(child)],
    history,
    history,
  );
});

it("lets users reorder and remove members without typing identifiers", async () => {
  const user = userEvent.setup();
  const first = hashEntry(1),
    second = hashEntry(2);
  render(<AggregatePanel {...props()} />);
  await user.upload(screen.getByLabelText("Import group proof files"), [
    proofFile([first]),
    proofFile([second]),
    proofFile([first]),
  ]);
  const selectedList = screen.getByRole("list", {
    name: "Selected group members",
  });
  const original = within(selectedList)
    .getAllByRole("listitem")
    .map((row) => within(row).getByText(/^[0-9a-f]{64}$/).textContent!);
  expect(original).toHaveLength(2);
  expect(
    screen
      .getAllByRole("checkbox")
      .every((checkbox) => (checkbox as HTMLInputElement).checked),
  ).toBe(true);
  await user.click(button("Move member 2 up"));
  const rows = within(
    screen.getByRole("list", { name: "Selected group members" }),
  ).getAllByRole("listitem");
  expect(rows[0].textContent).toContain(original[1]);
  expect(rows[1].textContent).toContain(original[0]);
  await user.click(button("Remove member 1"));
  await user.click(button("Check members & preview — no fee"));
  expect(state.check.mock.calls.at(-1)?.[2]).toBe(original[0]);
  await user.click(button("Remove member 1"));
  expect(button("Create batch + first vote").disabled).toBe(true);
});

it("clears old selections immediately and ignores a stale replacement file read", async () => {
  const user = userEvent.setup();
  const entry = hashEntry();
  render(<AggregatePanel {...props()} />);
  const input = screen.getByLabelText("Import group proof files");
  await user.upload(input, proofFile([entry]));
  expect(button("Create batch + first vote").disabled).toBe(false);
  await user.click(button("Check members & preview — no fee"));
  const slow = proofFile([entry]);
  let finish!: (value: string) => void;
  Object.defineProperty(slow, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  await user.upload(input, slow);
  expect(button("Create batch + first vote").disabled).toBe(true);
  expect(screen.queryByText("New batch PDA")).toBeNull();
  await user.upload(input, proofFile([hashEntry(2)]));
  await act(async () =>
    finish(stringifyArchive(archiveFromProof(IDL.address, [entry]))),
  );
  expect(
    screen.queryByRole("checkbox", { name: `Select record ${entryId(entry)}` }),
  ).toBeNull();
  expect(
    screen.getByRole("checkbox", {
      name: `Select record ${entryId(hashEntry(2))}`,
    }),
  ).toBeTruthy();
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  expect(button("Create batch + first vote").disabled).toBe(false);
});

it("does not reuse old members after failed imports and respects the transaction lock", async () => {
  const user = userEvent.setup();
  const p = props();
  const view = render(<AggregatePanel {...p} />);
  const file = proofFile([hashEntry()]);
  await user.upload(screen.getByLabelText("Import group proof files"), file);
  state.busy = true;
  view.rerender(<AggregatePanel {...p} />);
  expect(
    (screen.getByLabelText("Import group proof files") as HTMLInputElement)
      .disabled,
  ).toBe(true);
  expect(button("Create batch + first vote").disabled).toBe(true);
  state.busy = false;
  view.rerender(<AggregatePanel {...p} />);
  const broken = proofFile([hashEntry()]);
  Object.defineProperty(broken, "text", {
    value: vi.fn().mockRejectedValue(new Error("Cannot read file")),
  });
  await user.upload(screen.getByLabelText("Import group proof files"), broken);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Cannot read file"),
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(button("Create batch + first vote").disabled).toBe(true);
});

it("selects all imported records but requires reducing to 32 before checking or submitting", async () => {
  const user = userEvent.setup();
  const p = props();
  render(<AggregatePanel {...p} />);
  await user.upload(
    screen.getByLabelText("Import group proof files"),
    proofFile(Array.from({ length: 34 }, (_, index) => hashEntry(index + 1))),
  );
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(34);
  expect(screen.getByRole("alert").textContent).toContain(
    "34 records selected",
  );
  expect(button("Check members & preview — no fee").disabled).toBe(true);
  expect(button("Create batch + first vote").disabled).toBe(true);
  fireEvent.submit(button("Create batch + first vote").closest("form")!);
  expect(p.run).not.toHaveBeenCalled();
  expect(button("Move member 32 down").disabled).toBe(true);
  await user.click(screen.getAllByRole("checkbox")[33]);
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(33);
  expect(button("Create batch + first vote").disabled).toBe(true);
  expect(button("Check members & preview — no fee").disabled).toBe(true);
  await user.click(screen.getAllByRole("checkbox")[32]);
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(32);
  expect(button("Create batch + first vote").disabled).toBe(false);
  await user.click(button("Check members & preview — no fee"));
  expect(state.check.mock.calls.at(-1)?.[2].split("\n")).toHaveLength(32);
  await user.click(button("Clear selection"));
  expect(button("Create batch + first vote").disabled).toBe(true);
});

it("preselects records beyond the first page and can clear a large imported selection", async () => {
  const user = userEvent.setup();
  render(<AggregatePanel {...props()} />);
  await user.upload(
    screen.getByLabelText("Import group proof files"),
    proofFile(Array.from({ length: 51 }, (_, index) => hashEntry(index + 1))),
  );
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(50);
  expect(
    within(
      screen.getByRole("list", { name: "Selected group members" }),
    ).getAllByRole("listitem"),
  ).toHaveLength(32);
  await user.click(button("Next records"));
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
  await user.click(button("Clear selection"));
  expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
  await user.click(screen.getByRole("checkbox"));
  expect(button("Create batch + first vote").disabled).toBe(false);
});
