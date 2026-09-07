import type { Page } from "@playwright/test";

const sections = {
  Inspect: "Verify",
  "Proof check": "Verify",
  Timestamp: "Create",
  Branch: "Create",
  "Batch / Pack": "Create",
  Account: "Create",
  "Merge proofs": "History",
  "Proof inspector": "History",
  Restore: "History",
} as const;

export async function openTool(page: Page, tool: keyof typeof sections) {
  await page
    .getByRole("navigation", { name: "Workspace sections" })
    .getByRole("button", { name: sections[tool], exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Record operations" })
    .getByRole("button", { name: tool, exact: true })
    .click();
}
