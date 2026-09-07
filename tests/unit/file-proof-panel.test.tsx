// @vitest-environment jsdom
import { File as NodeFile } from "node:buffer";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  archiveFromProof,
  IDL,
  stringifyArchive,
} from "../../src/contract/sdk";
import { FileProofPanel } from "../../src/features/history/FileProofPanel";

const state = vi.hoisted(() => ({ busy: false, check: vi.fn() }));
vi.mock("../../src/contract/network", () => ({
  useNetwork: () => ({
    busy: state.busy,
    network: { label: "Localnet", endpoint: "http://127.0.0.1:8899" },
  }),
}));
vi.mock("../../src/features/workspace/use-contract", () => ({
  useContract: () => ({ client: {} }),
}));
vi.mock("../../src/features/history/file-proof", async (original) => ({
  ...(await original<typeof import("../../src/features/history/file-proof")>()),
  checkFileProof: state.check,
}));

beforeEach(() => {
  vi.stubGlobal(
    "Uint8Array",
    Object.getPrototypeOf(Buffer.prototype).constructor,
  );
  state.busy = false;
  state.check.mockResolvedValue({
    matched: true,
    message: "Timestamp matches.",
    checked: 1,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const digest = (contents: string) =>
  createHash("sha256").update(contents).digest("hex");
function file(contents: string, name: string) {
  const actual = new NodeFile([contents], name);
  const selected = new File([contents], name);
  // jsdom does not implement the native Blob reading APIs used by the browser.
  Object.defineProperties(selected, {
    text: { value: () => actual.text(), configurable: true },
    slice: { value: actual.slice.bind(actual) },
  });
  return selected;
}
function proof(contents = "my file") {
  return file(
    stringifyArchive(
      archiveFromProof(IDL.address, [
        {
          hash: digest(contents),
          source: { kind: "hash" },
          createdAt: 1700000000n,
        },
      ]),
    ),
    "proof.json",
  );
}
const search = () =>
  screen.getByRole("button", {
    name: "Find file in proof",
  }) as HTMLButtonElement;

it("requires both files, searches locally, and shows a saved timestamp before optional network checking", async () => {
  const user = userEvent.setup();
  render(<FileProofPanel />);
  expect(search().disabled).toBe(true);
  await user.upload(screen.getByLabelText("Proof file to search"), proof());
  expect(search().disabled).toBe(true);
  await user.upload(
    screen.getByLabelText("File to check"),
    file("my file", "notes.txt"),
  );
  await waitFor(() => expect(search().disabled).toBe(false));
  await user.click(search());
  expect(
    screen.getByRole("heading", { name: "File found in saved history" }),
  ).toBeTruthy();
  expect(screen.getByText("2023-11-14T22:13:20.000Z")).toBeTruthy();
  expect(
    screen.getByText(/saved timestamp alone is not network confirmation/),
  ).toBeTruthy();
  expect(state.check).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Check on network — no fee" }),
  );
  expect(
    await screen.findByText("Matches live history · Localnet"),
  ).toBeTruthy();
});

it("hashes an empty file and clears matches after a changed resource or malformed proof", async () => {
  const user = userEvent.setup();
  render(<FileProofPanel />);
  await user.upload(screen.getByLabelText("Proof file to search"), proof(""));
  await user.upload(
    screen.getByLabelText("File to check"),
    file("", "empty.txt"),
  );
  await user.click(search());
  expect(screen.getByText("2023-11-14T22:13:20.000Z")).toBeTruthy();
  await user.upload(
    screen.getByLabelText("File to check"),
    file("changed", "changed.txt"),
  );
  expect(screen.queryByText("2023-11-14T22:13:20.000Z")).toBeNull();
  await waitFor(() => expect(search().disabled).toBe(false));
  await user.click(search());
  expect(
    screen.getByRole("heading", { name: "File not found in this proof" }),
  ).toBeTruthy();
  await user.upload(
    screen.getByLabelText("Proof file to search"),
    file("{", "broken.json"),
  );
  expect(
    screen.queryByRole("heading", { name: "File not found in this proof" }),
  ).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("broken.json");
  expect(search().disabled).toBe(true);
});

it("ignores network confirmation from a replaced file and locks controls during a transaction", async () => {
  const user = userEvent.setup();
  const view = render(<FileProofPanel />);
  await user.upload(screen.getByLabelText("Proof file to search"), proof());
  await user.upload(
    screen.getByLabelText("File to check"),
    file("my file", "notes.txt"),
  );
  await waitFor(() => expect(search().disabled).toBe(false));
  await user.click(search());
  let finish!: (value: object) => void;
  state.check.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(
    screen.getByRole("button", { name: "Check on network — no fee" }),
  );
  await user.upload(
    screen.getByLabelText("File to check"),
    file("other", "other.txt"),
  );
  expect(state.check.mock.calls[0][4].aborted).toBe(true);
  await act(async () =>
    finish({ matched: true, checked: 1, message: "Obsolete result" }),
  );
  expect(screen.queryByText("Obsolete result")).toBeNull();
  state.busy = true;
  view.rerender(<FileProofPanel />);
  expect(search().disabled).toBe(true);
  expect(
    (screen.getByLabelText("File to check") as HTMLInputElement).disabled,
  ).toBe(true);
});

it("ignores an older proof read after a newer proof has loaded", async () => {
  const user = userEvent.setup();
  render(<FileProofPanel />);
  await user.upload(
    screen.getByLabelText("File to check"),
    file("my file", "notes.txt"),
  );
  const slow = proof("old");
  const contents = await slow.text();
  let finish!: (value: string) => void;
  Object.defineProperty(slow, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  await user.upload(screen.getByLabelText("Proof file to search"), slow);
  expect(search().disabled).toBe(true);
  await user.upload(screen.getByLabelText("Proof file to search"), proof());
  await act(async () => finish(contents));
  await user.click(search());
  expect(screen.getByText("2023-11-14T22:13:20.000Z")).toBeTruthy();
});
