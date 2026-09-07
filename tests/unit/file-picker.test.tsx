// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilePicker } from "../../src/features/workspace/FilePicker";

afterEach(cleanup);

it("keeps a named native input and permits selecting the same proof again", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(
    <FilePicker
      label="Import proof JSON"
      prompt="Choose a saved proof"
      hint="Proof JSON · up to 2 MB."
      accept="application/json,.json"
      onSelect={onSelect}
    />,
  );
  const input = screen.getByLabelText("Import proof JSON") as HTMLInputElement;
  expect(input.type).toBe("file");
  expect(input.accept).toBe("application/json,.json");
  expect(
    document.getElementById(input.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe("Proof JSON · up to 2 MB.");
  const proof = new File(["[]"], "history.json", { type: "application/json" });
  await user.upload(input, proof);
  await user.upload(input, proof);
  expect(onSelect).toHaveBeenCalledTimes(2);
  expect(onSelect).toHaveBeenLastCalledWith(proof);
  expect(input.value).toBe("");
});

it("reflects the chosen filename and blocks disabled file selection", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  const props = {
    label: "New file version",
    prompt: "Choose a new file version",
    hint: "Files stay in your browser.",
    onSelect,
  };
  const { rerender } = render(
    <FilePicker {...props} fileName="version-2.txt" disabled />,
  );
  const input = screen.getByLabelText("New file version") as HTMLInputElement;
  expect(screen.getByText("version-2.txt")).toBeTruthy();
  expect(screen.getByText("Choose another file")).toBeTruthy();
  expect(input.disabled).toBe(true);
  await user.upload(input, new File(["new"], "next.txt"));
  expect(onSelect).not.toHaveBeenCalled();
  rerender(<FilePicker {...props} />);
  expect(screen.queryByText("version-2.txt")).toBeNull();
  expect(screen.getByText("Choose a new file version")).toBeTruthy();
  expect(input.disabled).toBe(false);
});
