import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { BN, BorshAccountsCoder } from "@coral-xyz/anchor";
import {
  IDL,
  canonicalHashId,
  deriveBranchHash,
  deriveGenesisHashId,
  deriveHashPda,
} from "../../src/contract/sdk";
import { PublicKey } from "@solana/web3.js";

const program = IDL.address;
const digest = (data: Uint8Array) => createHash("sha256").update(data).digest();
const payload = digest(Buffer.from("sample file contents"));
const canonical = digest(Buffer.concat([payload, Buffer.from([0])])).toString(
  "hex",
);

async function liveHashData() {
  return (
    await new BorshAccountsCoder(IDL).encode("hashAccount", {
      hash: [...payload],
      source: { hash: {} },
      voters: new BN(1),
      createdAt: new BN(1700000000),
      bump: 1,
    })
  ).toString("base64");
}
const recordPda = () =>
  deriveHashPda(
    new PublicKey(program),
    deriveGenesisHashId(payload),
  ).toBase58();

async function rpc(page: Page, accountData?: string, fail = false) {
  const pda = deriveHashPda(
    new PublicKey(program),
    deriveGenesisHashId(payload),
  ).toBase58();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173") return route.continue();
    if (url.origin !== "http://127.0.0.1:8899") return route.abort();
    if (fail) return route.fulfill({ status: 503, body: "RPC unavailable" });
    const request = route.request().postDataJSON();
    const address = request.params?.[0];
    const value =
      address === program
        ? {
            executable: true,
            owner: "BPFLoader2111111111111111111111111111111111",
            lamports: 1,
            rentEpoch: 0,
            data: ["", "base64"],
          }
        : address === pda && accountData
          ? {
              executable: false,
              owner: program,
              lamports: 1,
              rentEpoch: 0,
              data: [accountData, "base64"],
            }
          : null;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { context: { slot: 1 }, value },
      }),
    });
  });
}

test("disables empty operation inputs and re-enables checks when data is entered", async ({
  page,
}) => {
  await rpc(page);
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Record operations" });
  await expect(
    page.getByRole("button", { name: "Look up", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Canonical ID or account PDA").fill("   ");
  await page.getByLabel("Canonical ID or account PDA").press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Canonical ID or account PDA").fill(canonical);
  await expect(
    page.getByRole("button", { name: "Look up", exact: true }),
  ).toBeEnabled();
  await tabs.getByRole("button", { name: "Branch", exact: true }).click();
  await page.getByLabel("Parent canonical ID or PDA").fill("   ");
  await page.getByLabel("New payload / file digest").fill("ab".repeat(32));
  await expect(
    page.getByRole("button", { name: "Check parent & preview — no fee" }),
  ).toBeDisabled();
  await page.getByLabel("Parent canonical ID or PDA").fill(canonical);
  await expect(
    page.getByRole("button", { name: "Check parent & preview — no fee" }),
  ).toBeEnabled();
  await tabs.getByRole("button", { name: "Batch / Pack", exact: true }).click();
  for (const mode of [
    "Batch — stores ordered member IDs",
    "Pack — digest only",
  ]) {
    await page.getByRole("combobox", { name: "Aggregate mode" }).click();
    await page.getByRole("option", { name: mode, exact: true }).click();
    await page.getByLabel("Ordered canonical IDs or PDAs").fill(" ,\n , ");
    await expect(
      page.getByRole("button", { name: "Check members & preview — no fee" }),
    ).toBeDisabled();
    await page.getByLabel("Ordered canonical IDs or PDAs").fill(canonical);
    await expect(
      page.getByRole("button", { name: "Check members & preview — no fee" }),
    ).toBeEnabled();
  }
  await tabs.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByLabel("Proof chain JSON").fill(" \n ");
  await expect(
    page.getByRole("button", { name: "Check format & load history" }),
  ).toBeDisabled();
  await page
    .getByLabel("Proof chain JSON")
    .fill(
      JSON.stringify([
        {
          hash: payload.toString("hex"),
          source: { kind: "hash" },
          createdAt: "100",
        },
      ]),
    );
  await expect(
    page.getByRole("button", { name: "Check format & load history" }),
  ).toBeEnabled();
  await page.getByLabel("Proof chain JSON").fill("");
  await expect(
    page.getByRole("button", { name: "Check format & load history" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("accepts a PDA in Inspect and previews branches and mixed aggregate members without a wallet", async ({
  page,
}, testInfo) => {
  await rpc(page, await liveHashData());
  await page.goto("/");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("dark");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.body, "::before").backgroundImage,
    ),
  ).toContain("crypto-security-bg");
  await page.screenshot({
    path: testInfo.outputPath("workspace-dark.png"),
    fullPage: true,
  });
  const tabs = page.getByRole("navigation", { name: "Record operations" });
  await expect(tabs.getByRole("button")).toHaveText([
    "Inspect",
    "Timestamp",
    "Branch",
    "Batch / Pack",
    "Account",
    "Restore",
    "Proofs",
  ]);
  await expect(
    tabs.getByRole("button", { name: "Inspect", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByLabel("Canonical ID or account PDA").fill(recordPda());
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await expect(page).toHaveURL(`/records/${canonical}`);
  await expect(page.getByText("2023-11-14T22:13:20.000Z")).toBeVisible();
  await tabs.getByRole("button", { name: "Branch", exact: true }).click();
  await page.getByLabel("Parent canonical ID or PDA").fill(recordPda());
  await page.getByLabel("New payload / file digest").fill("ab".repeat(32));
  await page
    .getByRole("button", { name: "Check parent & preview — no fee" })
    .click();
  await expect(page.getByText("New branch PDA", { exact: true })).toBeVisible();
  await page.getByLabel("New payload / file digest").fill("cd".repeat(32));
  await expect(page.getByText("New branch PDA", { exact: true })).toHaveCount(
    0,
  );
  await tabs.getByRole("button", { name: "Batch / Pack", exact: true }).click();
  await page
    .getByLabel("Ordered canonical IDs or PDAs")
    .fill(`${canonical}\n${recordPda()}`);
  await page
    .getByRole("button", { name: "Check members & preview — no fee" })
    .click();
  await expect(page.getByRole("alert")).toContainText("same record");
  await page.getByLabel("Ordered canonical IDs or PDAs").fill(recordPda());
  await page
    .getByRole("button", { name: "Check members & preview — no fee" })
    .click();
  await expect(page.getByText("New batch PDA", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Aggregate mode" }).click();
  await page
    .getByRole("option", { name: "Pack — digest only", exact: true })
    .click();
  await expect(page.getByText("New batch PDA", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Check members & preview — no fee" })
    .click();
  await expect(page.getByText("New pack PDA", { exact: true })).toBeVisible();
});

test("branches from a previous record and a locally hashed new file version", async ({
  page,
}, testInfo) => {
  const contents = Buffer.from("second version of my file");
  const nextPayload = digest(contents);
  const nextId = Buffer.from(
    canonicalHashId(
      deriveBranchHash(canonical, 1700000000n, 0n, 0, nextPayload),
      2,
    ),
  ).toString("hex");
  await rpc(page, await liveHashData());
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Record operations" })
    .getByRole("button", { name: "Branch", exact: true })
    .click();
  await page.getByLabel("Parent canonical ID or PDA").fill(recordPda());
  const withdraw = page.getByRole("checkbox", {
    name: "Withdraw my parent vote after creating the child",
  });
  await expect(withdraw).not.toBeChecked();
  await withdraw.focus();
  await page.keyboard.press("Space");
  await expect(withdraw).toBeChecked();
  await page.keyboard.press("Space");
  await expect(withdraw).not.toBeChecked();
  const file = {
    name: "version-2.txt",
    mimeType: "text/plain",
    buffer: contents,
  };
  await page.getByLabel("New file version").setInputFiles(file);
  await expect(page.getByLabel("New payload / file digest")).toHaveValue(
    nextPayload.toString("hex"),
  );
  await expect(page.getByText(file.name, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Check parent & preview — no fee" })
    .click();
  await expect(page.getByText(nextId, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create branch + first vote" }),
  ).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("branch-file.png"),
    fullPage: true,
  });
  await page.getByLabel("New payload / file digest").fill("ab".repeat(32));
  await expect(page.getByText(file.name, { exact: true })).toHaveCount(0);
  await expect(page.getByText(nextId, { exact: true })).toHaveCount(0);
  // Selecting the same file again must recompute the digest after manual editing.
  await page.getByLabel("New file version").setInputFiles(file);
  await expect(page.getByLabel("New payload / file digest")).toHaveValue(
    nextPayload.toString("hex"),
  );
});

async function chooseDoc(page: Page, id: string, label: string) {
  const nav = page.getByRole("navigation", { name: "Documentation topics" });
  if (await nav.isVisible()) {
    await nav.getByRole("link", { name: label, exact: true }).click();
  } else {
    await page.getByRole("combobox", { name: "Documentation topic" }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
  }
  await expect(page).toHaveURL(`/docs/${id}`);
}

test("opens routed documentation and preserves the selected record and draft on return", async ({
  page,
}, testInfo) => {
  await rpc(page, await liveHashData());
  await page.goto(`/records/${canonical}`);
  await expect(page.getByText("2023-11-14T22:13:20.000Z")).toBeVisible();
  await page.getByLabel("Canonical ID or account PDA").fill("ab".repeat(32));
  await page.getByRole("link", { name: "Docs & guides", exact: true }).click();
  await expect(page).toHaveURL("/docs/getting-started");
  await expect(
    page.getByRole("heading", {
      name: "Timestamp and check a file",
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    page.getByText("Keep the file and download its proof.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("docs-start.png") });
  await chooseDoc(page, "use-cases", "Use cases");
  await expect(
    page.getByText("Document versions.", { exact: true }),
  ).toBeVisible();
  await chooseDoc(page, "branch", "File versions / Branch");
  await expect(
    page.getByRole("heading", { name: "Update a file with Branch" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/docs/use-cases");
  await chooseDoc(page, "restore", "History / Restore");
  await expect(
    page.getByText(
      "record in that proof must still exist on the original network.",
      {
        exact: false,
      },
    ),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("docs-restore.png") });
  await page
    .getByRole("link", { name: "Back to workspace", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(`/records/${canonical}`);
  await expect(
    page.getByRole("link", { name: "Docs & guides", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Canonical ID or account PDA")).toHaveValue(
    "ab".repeat(32),
  );
  await expect(page.getByText("2023-11-14T22:13:20.000Z")).toBeVisible();
});

test("documentation deep links work offline, fit small screens and handle unknown topics", async ({
  page,
}, testInfo) => {
  let rpcCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes(":8899")) rpcCalls++;
  });
  await rpc(page, undefined, true);
  await page.goto("/docs/restore");
  await expect(
    page.getByRole("heading", { name: "Save history and use Restore" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Save history and use Restore" }),
  ).toBeVisible();
  expect(rpcCalls).toBe(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await chooseDoc(page, "getting-started", "Getting started");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const article = page.getByRole("article");
  expect(
    await article.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        bounds.bottom <= innerHeight &&
        element.scrollWidth <= element.clientWidth
      );
    }),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("docs-small-screen.png") });
  await page.goto("/docs/not-a-topic");
  await expect(
    page.getByRole("heading", { name: "Topic not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open Getting started" }).click();
  await expect(page).toHaveURL("/docs/getting-started");
  await page
    .getByRole("link", { name: "Back to workspace", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("navigation", { name: "Record operations" }),
  ).toBeVisible();
});

test("documentation highlights proof limitations and clearly links to GitHub", async ({
  page,
}, testInfo) => {
  await rpc(page, undefined, true);
  await page.goto("/docs/proofs");
  await expect(
    page.getByRole("complementary", {
      name: "Keep the original proof files too",
    }),
  ).toContainText("The merged download cannot be used directly in Restore.");
  await expect(page.getByRole("article")).not.toContainText(/\bSDK\b|\bRPC\b/);
  await chooseDoc(page, "developers", "Developer resources");
  const repository = page.getByRole("link", {
    name: "Open binqbit/hash-timestamp on GitHub (opens in a new tab)",
  });
  await expect(repository).toHaveAttribute(
    "href",
    "https://github.com/binqbit/hash-timestamp",
  );
  await expect(repository).toContainText("GitHub repository");
  await expect(repository).toContainText("View on GitHub");
  await expect(
    page.getByRole("article").getByRole("link", { name: /GitHub/ }),
  ).toHaveCount(1);
  await repository.focus();
  await expect(repository).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("docs-developers.png") });
  await page.setViewportSize({ width: 320, height: 568 });
  await repository.scrollIntoViewIfNeeded();
  expect(
    await page.getByRole("article").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        bounds.bottom <= innerHeight &&
        element.scrollWidth <= element.clientWidth
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("docs-developers-small.png"),
  });
});

test("checks restore against a live anchor and invalidates the result on editing", async ({
  page,
}, testInfo) => {
  await rpc(page, await liveHashData());
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Record operations" })
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  const input = JSON.stringify([
    {
      hash: payload.toString("hex"),
      source: { kind: "hash" },
      createdAt: "1700000000",
      params: { kind: "hash", payload: payload.toString("hex") },
    },
  ]);
  await page.getByLabel("Import proof JSON", { exact: true }).setInputFiles({
    name: "retained-proof.json",
    mimeType: "application/json",
    buffer: Buffer.from(input),
  });
  await expect(
    page.getByLabel("Proof chain JSON", { exact: true }),
  ).toHaveValue(input);
  await expect(
    page.getByText("retained-proof.json", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check format & load history" })
    .click();
  await page
    .getByRole("button", { name: "Check proof & live state — no fee" })
    .click();
  await expect(
    page.getByText("Preflight checks passed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Docs & guides", exact: true }).click();
  await page
    .getByRole("link", { name: "Back to workspace", exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("Proof chain JSON", { exact: true }),
  ).toHaveValue(input);
  await expect(
    page.getByText("Preflight checks passed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Validate proof on-chain — fee" }),
  ).toBeDisabled();
  const network = page.getByRole("combobox", { name: "Network", exact: true });
  await network.click();
  await page.screenshot({ path: testInfo.outputPath("network-menu.png") });
  await page.getByRole("option", { name: "Devnet", exact: true }).click();
  const switchDialog = page.getByRole("alertdialog", {
    name: "Switch networks?",
  });
  await expect(switchDialog).toBeVisible();
  await expect
    .poll(() =>
      switchDialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          bounds.left >= 12 &&
          bounds.right <= innerWidth - 12 &&
          bounds.width <= 460
        );
      }),
    )
    .toBe(true);
  await expect(
    switchDialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("network-confirmation.png"),
  });
  await switchDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(switchDialog).toHaveCount(0);
  await expect(network).toHaveText("Localnet");
  await expect(network).toBeFocused();
  await expect(
    page.getByText("Preflight checks passed", { exact: true }),
  ).toBeVisible();
  await network.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe("hidden");
  await page
    .getByLabel("Proof chain JSON", { exact: true })
    .fill(input.replace("1700000000", "1700000001"));
  await expect(
    page.getByText("Preflight checks passed", { exact: true }),
  ).toHaveCount(0);
  // Clear only in-memory history before importing another incarnation.
  const clearHistory = page.getByRole("button", {
    name: "Clear retained history",
    exact: true,
  });
  await clearHistory.click();
  const clearDialog = page.getByRole("alertdialog", {
    name: "Clear retained history?",
  });
  await clearDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(clearDialog).toHaveCount(0);
  await expect(clearHistory).toBeFocused();
  await expect(
    page.getByText("1 historical entries retained in this tab's memory.", {
      exact: true,
    }),
  ).toBeVisible();
  await clearHistory.click();
  await clearDialog
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await expect(clearDialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Check format & load history" })
    .click();
  await page
    .getByRole("button", { name: "Check proof & live state — no fee" })
    .click();
  await expect(
    page.getByText("Preflight found problems", { exact: true }),
  ).toBeVisible();
});

test("remembers the selected wallet across reload and forgets it through the Wallet menu", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const listeners = new Map<string, Set<() => void>>();
    const wallet = {
      isPhantom: true,
      isConnected: false,
      publicKey: { toBytes: () => new Uint8Array(32).fill(6) },
      async connect() {
        this.isConnected = true;
      },
      async disconnect() {
        this.isConnected = false;
        listeners.get("disconnect")?.forEach((fn) => fn());
      },
      on(name: string, fn: () => void) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name)!.add(fn);
      },
      off(name: string, fn: () => void) {
        listeners.get(name)?.delete(fn);
      },
      async signTransaction() {
        throw new Error("This test must never sign");
      },
      async signAllTransactions() {
        throw new Error("This test must never sign");
      },
    };
    Object.defineProperty(window, "phantom", {
      value: { solana: wallet },
      configurable: true,
    });
  });
  await rpc(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Select Wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Phantom/ }).click();
  const walletAddress = new PublicKey(new Uint8Array(32).fill(6)).toBase58();
  const walletButton = page.getByRole("button", {
    name: `${walletAddress.slice(0, 4)}..${walletAddress.slice(-4)}`,
  });
  await expect(walletButton).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Disconnect|Forget wallet/ }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("walletName"))).toBe(
    '"Phantom"',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(walletButton).toBeVisible();
  await walletButton.click();
  await page
    .getByRole("menuitem", { name: "Disconnect", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select Wallet", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("walletName")),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Select Wallet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Disconnect|Forget wallet/ }),
  ).toHaveCount(0);
});

test("hashes a file offline, derives the current canonical ID and looks up without a wallet", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await rpc(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Evidence stays connected.",
  );
  await page
    .getByRole("navigation", { name: "Record operations" })
    .getByRole("button", { name: "Timestamp", exact: true })
    .click();
  await page.getByLabel("File to timestamp").setInputFiles({
    name: "sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("sample file contents"),
  });
  await expect(page.getByLabel("Raw SHA-256 / 32-byte value")).toHaveValue(
    payload.toString("hex"),
  );
  await expect(page.getByText(canonical, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Register + first vote", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Inspect record — no fee" }).click();
  await expect(page).toHaveURL(`/records/${canonical}`);
  await expect(
    page.getByText("No live record was found.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("decodes the current IDL account and exports a proof without signing", async ({
  page,
}, testInfo) => {
  const data = await new BorshAccountsCoder(IDL).encode("hashAccount", {
    hash: [...payload],
    source: { hash: {} },
    voters: new BN(3),
    createdAt: new BN(1700000000),
    bump: 1,
  });
  await rpc(page, data.toString("base64"));
  await page.goto(`/records/${canonical}`);
  await expect(page.getByText("2023-11-14T22:13:20.000Z")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify on-chain — fee", exact: true }),
  ).toBeDisabled();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download proof", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toBe(
    `proof-${canonical.slice(0, 12)}.json`,
  );
  await page
    .getByRole("button", { name: "Refresh record", exact: true })
    .click();
  await expect(
    page.getByText("RPC read failed:", { exact: false }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("record.png"),
    fullPage: true,
  });
});

test("permits offline proof parsing but never confuses it with on-chain verification", async ({
  page,
}) => {
  await rpc(page, undefined, true);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Record operations" })
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  const proof = [
    {
      hash: payload.toString("hex"),
      source: { kind: "hash" },
      createdAt: "1700000000",
      params: { kind: "hash", payload: payload.toString("hex") },
    },
  ];
  await page
    .getByLabel("Proof chain JSON", { exact: true })
    .fill(JSON.stringify(proof));
  await page
    .getByRole("button", { name: "Check format & load history" })
    .click();
  await expect(
    page.getByText("Format checked locally;", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Validate proof on-chain — fee" }),
  ).toBeDisabled();
  await page.getByLabel("Proof chain JSON", { exact: true }).fill(
    JSON.stringify({
      format: "hash-timestamp-proof-v1",
      programId: program,
      rpc: "https://api.devnet.solana.com",
      proof,
    }),
  );
  await page
    .getByRole("button", { name: "Check format & load history" })
    .click();
  await expect(
    page.getByText("This proof export belongs to another program or RPC.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("shows RPC errors separately from a missing record and supports old raw-hash links", async ({
  page,
}) => {
  await rpc(page, undefined, true);
  await page.goto(`/hash/${payload.toString("hex")}`);
  await expect(
    page.getByLabel("Canonical ID or account PDA", { exact: true }),
  ).toHaveValue(canonical);
  await expect(
    page.getByText("RPC read failed:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("No live record was found.", { exact: false }),
  ).toHaveCount(0);
});
