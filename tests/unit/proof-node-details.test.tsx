// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ArchiveNode } from "../../src/contract/sdk";
import { ProofNodeDetails } from "../../src/features/history/ProofNodeDetails";
import { proofRecordedDate } from "../../src/features/history/proof-node-display";
import type { ProofGraphNode } from "../../src/features/history/proof-graph";

afterEach(cleanup);
const account = "11111111111111111111111111111111";
const id = "ab".repeat(32);
const hash = "cd".repeat(32);
const node = (record?: ArchiveNode): ProofGraphNode => ({
  pda: account,
  id: record ? id : undefined,
  record,
  dependencies: [],
  referencedBy: [],
});
const record = (source: ArchiveNode["source"]): ArchiveNode => ({
  hash,
  source,
  createdAt: "1700000001",
});

it("shows a readable UTC date and essential preview IDs, not raw seconds or graph counters", () => {
  const input = node(record({ kind: "hash" }));
  const before = JSON.stringify(input);
  const { container } = render(<ProofNodeDetails node={input} compact />);
  expect(screen.getByText("14 Nov 2023")).toBeTruthy();
  expect(screen.getByText("UTC")).toBeTruthy();
  expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
    "2023-11-14T22:13:21.000Z",
  );
  expect(container.querySelector("time")?.textContent).toContain("22:13:21");
  expect(screen.getByText(`${id.slice(0, 8)}…${id.slice(-6)}`)).toBeTruthy();
  expect(
    screen.getByText(`${account.slice(0, 8)}…${account.slice(-6)}`),
  ).toBeTruthy();
  expect(screen.queryByText(hash)).toBeNull();
  expect(container.textContent).not.toMatch(
    /1700000001|Timestamp in seconds|historical links|referenced by/,
  );
  expect(container.querySelector("button, a, input")).toBeNull();
  expect(JSON.stringify(input)).toBe(before);
});

it("keeps Branch payload and previous ID distinct without duplicating its derived stored hash", () => {
  const payload = "ef".repeat(32),
    previousHashId = "01".repeat(32);
  render(
    <ProofNodeDetails
      node={node(
        record({
          kind: "branch",
          payload,
          previousHashId,
          generation: "18446744073709551615",
        }),
      )}
    />,
  );
  expect(screen.getByText(payload)).toBeTruthy();
  expect(screen.getByText(previousHashId)).toBeTruthy();
  expect(screen.getByText("18446744073709551615")).toBeTruthy();
  expect(screen.getByText(id)).toBeTruthy();
  expect(screen.queryByText(hash)).toBeNull();
});

it("shows saved group member counts but never calls unknown Pack membership empty", () => {
  const batch = node(record({ kind: "batch", members: [id, hash] }));
  const { container, rerender } = render(
    <ProofNodeDetails node={batch} compact />,
  );
  expect(container.textContent).toContain("2 members");
  const pack = node(record({ kind: "pack" }));
  rerender(<ProofNodeDetails node={pack} compact />);
  expect(screen.getByText(/Member list not saved/)).toBeTruthy();
  expect(container.textContent).not.toContain("0 members");
  pack.record!.members = [account];
  rerender(<ProofNodeDetails node={pack} compact />);
  expect(container.textContent).toContain("1 member");
  expect(screen.queryByText(/Member list not saved/)).toBeNull();
});

it("distinguishes the proof account from the recorded Account target and preserves missing-snapshot warnings", () => {
  const target = "HTSx1wheA1TnHSEbKWxmtXKgJNyRfF3QxeK2hHQcJ9pN";
  render(
    <ProofNodeDetails
      node={node(record({ kind: "account", account: target }))}
    />,
  );
  expect(
    screen.getByText("Proof account").nextElementSibling?.textContent,
  ).toBe(account);
  expect(
    screen.getByText("Recorded account").nextElementSibling?.textContent,
  ).toBe(target);
  expect(screen.getByText(/Account snapshot not saved/)).toBeTruthy();
});

it("does not invent a kind, ID, hash or date for missing references", () => {
  const { container } = render(<ProofNodeDetails node={node()} />);
  expect(screen.getByRole("heading", { name: "Missing record" })).toBeTruthy();
  expect(screen.getByText(account)).toBeTruthy();
  expect(screen.queryByText("Record ID")).toBeNull();
  expect(container.querySelector("time")).toBeNull();
  expect(screen.queryByText("Recorded time")).toBeNull();
});

it.each([
  "9223372036854775807",
  "-9223372036854775808",
  "8640000000001",
  "-8640000000001",
])(
  "handles out-of-calendar timestamp %s without displaying raw epoch seconds",
  (createdAt) => {
    const { container } = render(
      <ProofNodeDetails
        node={node({ ...record({ kind: "hash" }), createdAt })}
      />,
    );
    expect(screen.getByText("Outside supported date range")).toBeTruthy();
    expect(container.textContent).not.toContain(createdAt);
    expect(container.querySelector("time")).toBeNull();
  },
);

it("formats negative timestamps and both calendar boundaries without rounding or losing BCE", () => {
  expect(proofRecordedDate("-1")).toEqual({
    iso: "1969-12-31T23:59:59.000Z",
    day: "31 Dec 1969",
    time: "23:59:59",
  });
  expect(proofRecordedDate("8640000000000")?.iso).toBe(
    "+275760-09-13T00:00:00.000Z",
  );
  const earliest = proofRecordedDate("-8640000000000");
  expect(earliest?.iso).toBe("-271821-04-20T00:00:00.000Z");
  expect(earliest?.day).toContain("BC");
});
