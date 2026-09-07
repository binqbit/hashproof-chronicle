// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SelectField } from "../../src/components/SelectField";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const options = [
  { key: "batch", label: "Batch — stores ordered member IDs" },
  { key: "pack", label: "Pack — digest only" },
];

it("exposes a named combobox and preserves the mode when disabled", () => {
  const onChange = vi.fn();
  render(
    <SelectField
      label="Aggregate mode"
      value="batch"
      options={options}
      onChange={onChange}
      disabled
    />,
  );
  const trigger = screen.getByRole("combobox", {
    name: "Aggregate mode",
  }) as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  expect(trigger.textContent).toContain("Batch — stores ordered member IDs");
  trigger.click();
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

it("keeps an external field label associated and displays controlled mode changes", () => {
  const onChange = vi.fn();
  const field = (value: string) => (
    <>
      <label htmlFor="aggregate-kind">Aggregate mode</label>
      <SelectField
        id="aggregate-kind"
        label="Aggregate mode"
        value={value}
        options={options}
        onChange={onChange}
      />
    </>
  );
  const { rerender } = render(field("batch"));
  const trigger = screen.getByRole("combobox", { name: "Aggregate mode" });
  expect((screen.getByText("Aggregate mode") as HTMLLabelElement).control).toBe(
    trigger,
  );
  expect(trigger.textContent).toContain("Batch — stores ordered member IDs");
  rerender(field("pack"));
  expect(trigger.textContent).toContain("Pack — digest only");
  expect(onChange).not.toHaveBeenCalled();
});
