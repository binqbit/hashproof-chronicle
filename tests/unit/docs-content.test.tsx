// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DocContent } from "../../src/features/guide/DocContent";
import { docTopics } from "../../src/features/guide/topics";

afterEach(cleanup);

it("shows where to find each workspace tool in the getting-started guide", () => {
  const { container } = render(<DocContent topic="getting-started" />);
  const text = container.textContent;
  expect(text).toContain("Verify contains Inspect and Proof check");
  expect(text).toContain(
    "Create contains Timestamp, Branch, Batch / Pack and Account",
  );
  expect(text).toContain("History contains Manage proofs, Proof inspector");
  expect(text).toContain("Restore for recovering records");
});

it("explains independent and shared histories without claiming network verification", () => {
  render(<DocContent topic="proofs" />);
  const note = screen.getByRole("complementary", { name: "The tree shows only saved information" });
  expect(note.textContent).toContain("Missing links may connect histories");
  expect(note.textContent).toContain("does not check the network");
  expect(note.textContent).toContain("Each date belongs to its own record");
});

it.each(docTopics.filter((topic) => topic.id !== "developers"))(
  "$id explains user actions without implementation details",
  (topic) => {
    const { container } = render(<DocContent topic={topic.id} />);
    const text = `${topic.description} ${container.textContent}`;
    expect(text).not.toMatch(
      /\b(SDK|RPC|IDL|u64|i64)\b|entry zero|topological|hash-timestamp-(archive|proof)|program IDs?|byte arrays?/i,
    );
    expect(container.querySelector("pre, code")).toBeNull();
  },
);

it("identifies the original contract and SDK with one clear, safe GitHub link", () => {
  render(<DocContent topic="developers" />);
  const link = screen.getByRole("link", {
    name: "Open binqbit/hash-timestamp on GitHub (opens in a new tab)",
  });
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(link.getAttribute("href")).toBe(
    "https://github.com/binqbit/hash-timestamp",
  );
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")?.split(" ")).toEqual(
    expect.arrayContaining(["noopener", "noreferrer"]),
  );
  expect(link.textContent).toContain("GitHub repository");
  expect(link.textContent).toContain("Smart contract & SDK");
});

it("explains combined-file Restore support without claiming network validation", () => {
  render(<DocContent topic="proofs" />);
  const warning = screen.getByRole("complementary", {
    name: "Keep the original proof files too",
  });
  expect(warning.textContent).toContain("open the combined file in Restore");
  expect(warning.textContent).toContain("originals as a backup");
  expect(warning.textContent).toMatch(/does not\s+confirm their history/);
});

it("retains Restore prerequisites and explains that it cannot recover lost files", () => {
  render(<DocContent topic="restore" />);
  expect(
    screen.getByRole("complementary", { name: "Before you start" }).textContent,
  ).toMatch(
    /matching record must still exist on that network/,
  );
  expect(
    screen.getByRole("complementary", {
      name: "Restore records, not lost files",
    }).textContent,
  ).toContain("cannot recover the original file or fill in missing history");
});
