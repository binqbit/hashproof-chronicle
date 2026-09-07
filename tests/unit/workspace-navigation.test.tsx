// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceNavigation } from "../../src/features/workspace/WorkspaceNavigation";
import type { WorkspaceTool } from "../../src/features/workspace/navigation";

afterEach(cleanup);

function Navigation({ disabled = false }) {
  const [selected, setSelected] = useState<WorkspaceTool>("records");
  return (
    <WorkspaceNavigation
      selected={selected}
      disabled={disabled}
      onSelect={setSelected}
    />
  );
}

const sections = () =>
  within(screen.getByRole("navigation", { name: "Workspace sections" }));
const tools = () =>
  within(screen.getByRole("navigation", { name: "Record operations" }));

it("shows only the tools of the chosen section and keeps the current tool on repeated section clicks", async () => {
  const user = userEvent.setup();
  render(<Navigation />);
  expect(
    sections()
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Verify", "Create", "History"]);
  for (const [section, expected] of [
    ["Verify", ["Inspect", "Proof check"]],
    ["Create", ["Timestamp", "Branch", "Batch / Pack", "Account"]],
    ["History", ["Proofs", "Restore"]],
  ] as const) {
    await user.click(sections().getByRole("button", { name: section }));
    expect(
      tools()
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(expected);
    expect(
      sections()
        .getByRole("button", { name: section })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(tools().getByRole("button", { current: "page" }).textContent).toBe(
      expected[0],
    );
    for (const name of expected) {
      await user.click(tools().getByRole("button", { name }));
      await user.click(sections().getByRole("button", { name: section }));
      expect(tools().getByRole("button", { current: "page" }).textContent).toBe(
        name,
      );
    }
  }
});

it("derives the section from a tool selected outside navigation", () => {
  const onSelect = vi.fn();
  const view = render(
    <WorkspaceNavigation
      selected="branch"
      disabled={false}
      onSelect={onSelect}
    />,
  );
  expect(
    sections()
      .getByRole("button", { name: "Create" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  view.rerender(
    <WorkspaceNavigation
      selected="records"
      disabled={false}
      onSelect={onSelect}
    />,
  );
  expect(
    sections()
      .getByRole("button", { name: "Verify" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(tools().getByRole("button", { current: "page" }).textContent).toBe(
    "Inspect",
  );
  expect(onSelect).not.toHaveBeenCalled();
});

it("supports keyboard selection and blocks both levels while a transaction is pending", async () => {
  const user = userEvent.setup();
  const view = render(<Navigation />);
  sections().getByRole("button", { name: "Create" }).focus();
  await user.keyboard("{Enter}");
  const branch = tools().getByRole("button", { name: "Branch" });
  branch.focus();
  await user.keyboard(" ");
  expect(branch.getAttribute("aria-current")).toBe("page");

  view.rerender(<Navigation disabled />);
  for (const button of screen.getAllByRole("button")) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button);
  }
  expect(tools().getByRole("button", { current: "page" }).textContent).toBe(
    "Branch",
  );
  view.rerender(<Navigation />);
  await user.click(sections().getByRole("button", { name: "History" }));
  expect(tools().getByRole("button", { current: "page" }).textContent).toBe(
    "Proofs",
  );
});
