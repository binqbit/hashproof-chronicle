// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfirmationDialog } from "../../src/components/ConfirmationDialog";

afterEach(cleanup);

const content = {
  title: "Clear retained history?",
  description: "Saved files and on-chain accounts are not affected.",
  confirmLabel: "Clear history",
};

it("announces the confirmation and focuses Cancel without applying the operation", () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmationDialog
      {...content}
      open
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
    />,
  );
  expect(
    screen.getByRole("alertdialog", {
      name: content.title,
      description: content.description,
    }),
  ).toBeTruthy();
  const cancel = screen.getByRole("button", { name: "Cancel" });
  expect(document.activeElement).toBe(cancel);
  fireEvent.click(cancel);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onConfirm).not.toHaveBeenCalled();
});

it("only runs the operation on enabled confirmation", () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const { rerender } = render(
    <ConfirmationDialog
      {...content}
      open
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      disabled
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
  expect(onConfirm).not.toHaveBeenCalled();
  rerender(
    <ConfirmationDialog
      {...content}
      open
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("restores the initiating control when closing clears the parent's dialog metadata", async () => {
  const props = { ...content, onConfirm: vi.fn(), onOpenChange: vi.fn() };
  const view = (open: boolean, returnFocusId: string) => (
    <>
      <button id="network-selector">Network</button>
      <button id="clear-history">Clear retained history</button>
      <ConfirmationDialog
        {...props}
        open={open}
        returnFocusId={returnFocusId}
      />
    </>
  );
  const { rerender } = render(view(true, "network-selector"));
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Cancel" }),
  );
  rerender(view(false, "clear-history"));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      document.getElementById("network-selector"),
    ),
  );
  expect(document.activeElement).not.toBe(
    document.getElementById("clear-history"),
  );
});
