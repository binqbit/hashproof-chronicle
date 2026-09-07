// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  IDL,
  stringifyArchive,
  type ArchiveRestorePlan,
} from "../../src/contract/sdk";
import { RestorePanel } from "../../src/features/history/RestorePanel";
import type { RestoreGraphInteraction } from "../../src/features/history/RestoreGraphContext";
import type { ProofGraph } from "../../src/features/history/proof-graph";
import { pdaOf, proofForest } from "../fixtures/proof-forest";

const state = vi.hoisted(() => ({
  plan: vi.fn(),
  scan: vi.fn(),
  client: {},
  busy: false,
  payer: 6,
}));
vi.mock("../../src/contract/network", () => ({
  useNetwork: () => ({
    network: { endpoint: "http://127.0.0.1:8899" },
    busy: state.busy,
  }),
}));
vi.mock("../../src/features/workspace/use-contract", () => ({
  useContract: () => ({
    client: state.client,
    wallet: { publicKey: new PublicKey(new Uint8Array(32).fill(state.payer)) },
  }),
}));
vi.mock("../../src/features/history/restore-graph", async (original) => ({
  ...(await original<object>()),
  planGraphRestore: state.plan,
}));
vi.mock("../../src/features/history/restore-anchors", async (original) => ({
  ...(await original<object>()),
  readRestoreAnchors: state.scan,
}));
vi.mock("../../src/features/history/ProofGraphViewer", () => ({
  default: ({
    graph,
    restore,
  }: {
    graph: ProofGraph;
    restore: RestoreGraphInteraction;
  }) => (
    <div data-testid="graph">
      {[...graph.nodes.keys()].map((pda) => (
        <input
          key={pda}
          type="checkbox"
          aria-label={pda}
          checked={restore.selected.has(pda)}
          data-live={restore.anchors.has(pda)}
          onChange={() => restore.onToggle(pda)}
        />
      ))}
    </div>
  ),
}));
beforeEach(() => {
  vi.stubGlobal(
    "Uint8Array",
    Object.getPrototypeOf(Buffer.prototype).constructor,
  );
  state.busy = false;
  state.payer = 6;
  state.scan.mockResolvedValue(new Map());
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
  onHistory: vi.fn(),
});
const file = (contents: string) => {
  const value = new File([contents], "proof.json", {
    type: "application/json",
  });
  Object.defineProperty(value, "text", {
    value: async () => contents,
    configurable: true,
  });
  return value;
};
const upload = () => screen.getByLabelText("Proof file to restore");
const checkButton = () =>
  screen.getByRole("button", {
    name: /Check selected records — no fee|Checking restore paths/,
  }) as HTMLButtonElement;
const submit = () =>
  screen.getByRole("button", {
    name: /^Restore selected records/,
  }) as HTMLButtonElement;
function plan(): ArchiveRestorePlan {
  const f = proofForest();
  return {
    programId: IDL.address,
    payer: "",
    feePayer: "",
    alreadyPresent: [],
    rejectedAnchors: [],
    steps: [
      {
        anchor: pdaOf(f.branch),
        targets: [pdaOf(f.first)],
        proof: [f.branch, f.first],
        requestedAccounts: [pdaOf(f.first)],
        expectedCreations: [pdaOf(f.first)],
        additionalRequiredCreations: [],
        transactionBytes: 500,
      },
    ],
  };
}
async function load() {
  await userEvent
    .setup()
    .upload(upload(), file(stringifyArchive(proofForest().archive)));
  await screen.findByTestId("graph");
}

it("accepts files only, requires a selection and clears a checked plan when selection changes", async () => {
  const user = userEvent.setup(),
    operation = props();
  state.plan.mockResolvedValue(plan());
  render(<RestorePanel {...operation} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  await load();
  expect(checkButton().disabled).toBe(true);
  expect(submit().disabled).toBe(true);
  await user.click(screen.getByLabelText(pdaOf(proofForest().first)));
  await user.click(checkButton());
  expect(submit().disabled).toBe(false);
  await user.click(screen.getByLabelText(pdaOf(proofForest().second)));
  expect(screen.queryByLabelText("Restore plan")).toBeNull();
  expect(submit().disabled).toBe(true);
  expect(operation.run).not.toHaveBeenCalled();
});

it("requires explicit selection of mandatory intermediate records", async () => {
  const f = proofForest(),
    preview = plan();
  preview.steps[0].additionalRequiredCreations = [pdaOf(f.batch)];
  state.plan.mockResolvedValue(preview);
  render(<RestorePanel {...props()} />);
  await load();
  fireEvent.click(screen.getByLabelText(pdaOf(f.first)));
  await userEvent.setup().click(checkButton());
  expect(submit().disabled).toBe(true);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Select 1 required record(s)" }));
  expect(
    (screen.getByLabelText(pdaOf(f.batch)) as HTMLInputElement).checked,
  ).toBe(true);
  expect(screen.queryByLabelText("Restore plan")).toBeNull();
  expect(submit().disabled).toBe(true);
});

it("loads live status without selection, preserves it on planning errors, and refreshes independently", async () => {
  const f = proofForest();
  state.scan.mockResolvedValue(new Map([[pdaOf(f.pack), { kind: "live" }]]));
  state.plan.mockRejectedValue(new Error("Proof exceeds transaction size"));
  render(<RestorePanel {...props()} />);
  await load();
  const live = screen.getByLabelText(pdaOf(f.pack));
  await waitFor(() => expect(live.getAttribute("data-live")).toBe("true"));
  expect(state.plan).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(pdaOf(f.first)));
  await userEvent.setup().click(checkButton());
  await screen.findByText("Proof exceeds transaction size");
  expect(live.getAttribute("data-live")).toBe("true");
  fireEvent.click(screen.getByLabelText(pdaOf(f.second)));
  expect(live.getAttribute("data-live")).toBe("true");
  expect(state.scan).toHaveBeenCalledTimes(1);
  state.scan.mockResolvedValue(new Map([[pdaOf(f.pack), { kind: "missing" }]]));
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Refresh live records" }));
  await waitFor(() => expect(live.getAttribute("data-live")).toBe("false"));
  expect(submit().disabled).toBe(true);
});

it("ignores live status from a replaced file and aborts its scan", async () => {
  let finish!: (records: Map<string, { kind: "live" }>) => void;
  state.scan.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<RestorePanel {...props()} />);
  await load();
  const signal = state.scan.mock.calls[0][2] as AbortSignal;
  await load();
  await waitFor(() => expect(state.scan).toHaveBeenCalledTimes(2));
  expect(signal.aborted).toBe(true);
  await act(async () =>
    finish(new Map([[pdaOf(proofForest().pack), { kind: "live" }]])),
  );
  expect(
    screen.getByLabelText(pdaOf(proofForest().pack)).getAttribute("data-live"),
  ).toBe("false");
});

it("removes records from selection when a refresh discovers they already exist", async () => {
  const f = proofForest();
  render(<RestorePanel {...props()} />);
  await load();
  const target = screen.getByLabelText(pdaOf(f.first)) as HTMLInputElement;
  fireEvent.click(target);
  expect(target.checked).toBe(true);
  state.scan.mockResolvedValue(new Map([[pdaOf(f.first), { kind: "live" }]]));
  await userEvent.setup().click(screen.getByRole("button", { name: "Refresh live records" }));
  await waitFor(() => expect(target.checked).toBe(false));
  expect(target.getAttribute("data-live")).toBe("true");
  fireEvent.click(target); // also guard programmatic/stale events, beyond the disabled checkbox
  expect(target.checked).toBe(false);
  expect(checkButton().disabled).toBe(true);
  expect(submit().disabled).toBe(true);
});

it("invalidates wallet changes and ignores stale checks without starting overlapping RPC scans", async () => {
  let finish!: (value: ArchiveRestorePlan) => void;
  state.plan.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const operation = props(),
    view = render(<RestorePanel {...operation} />);
  await load();
  fireEvent.click(screen.getByLabelText(pdaOf(proofForest().first)));
  await userEvent.setup().click(checkButton());
  state.payer = 8;
  view.rerender(<RestorePanel {...operation} />);
  expect(checkButton().disabled).toBe(true);
  await act(async () => finish(plan()));
  expect(screen.queryByLabelText("Restore plan")).toBeNull();
  expect(submit().disabled).toBe(true);
  expect(checkButton().disabled).toBe(false);
});

it("cancels stale file reads, clears failed replacements, and still loads session-conflicting history", async () => {
  const operation = props();
  operation.onHistory.mockImplementation(() => {
    throw new Error("History conflict");
  });
  render(<RestorePanel {...operation} />);
  await load();
  expect(
    screen.getByText(/could not be combined with session history/),
  ).toBeTruthy();
  const delayed = file("old");
  let finish!: (value: string) => void;
  Object.defineProperty(delayed, "text", {
    value: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const user = userEvent.setup();
  await user.upload(upload(), delayed);
  expect(screen.queryByTestId("graph")).toBeNull();
  await user.upload(upload(), file("{"));
  await act(async () => finish(stringifyArchive(proofForest().archive)));
  expect(screen.queryByTestId("graph")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("proof.json");
  await user.click(screen.getByRole("button", { name: "Clear proof" }));
  expect(screen.queryByRole("alert")).toBeNull();
});
