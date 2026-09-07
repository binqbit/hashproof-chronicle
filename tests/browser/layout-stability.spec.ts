import { expect, test, type Page } from "@playwright/test";

// Headless Chromium normally hides scrollbars, which conceals these layout bugs.
test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
});

async function openWorkspace(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173") return route.continue();
    if (url.origin !== "http://127.0.0.1:8899") return route.abort();
    const request = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { context: { slot: 1 }, value: null },
      }),
    });
  });
  await page.goto("/");
  // Ensure this test exercises scrollbar removal even if screen content shrinks.
  await page.addStyleTag({ content: "body { min-height: 200vh; }" });
  await expect(
    page.getByText("Program not deployed", { exact: true }),
  ).toBeVisible();
}

async function layout(page: Page) {
  // Radix hides background landmarks from assistive technology while open.
  const header = await page
    .getByRole("banner", { includeHidden: true })
    .boundingBox();
  const main = await page
    .getByRole("main", { includeHidden: true })
    .boundingBox();
  return {
    header,
    main: { x: main?.x, width: main?.width },
    horizontalOverflow: await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  };
}

test("wallet and network popups preserve layout and restore scrolling", async ({
  page,
  isMobile,
}) => {
  await openWorkspace(page);
  const gap = await page.evaluate(
    () => innerWidth - document.documentElement.clientWidth,
  );
  if (!isMobile)
    expect(gap, "Exercise a real, non-overlay scrollbar").toBeGreaterThan(0);

  for (const narrow of [false, true]) {
    if (narrow) await page.setViewportSize({ width: 320, height: 720 });
    const before = await layout(page);
    expect(before.horizontalOverflow).toBe(false);

    await page
      .getByRole("button", { name: "Select Wallet", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe("hidden");
    await expect.poll(() => layout(page)).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe("hidden");
    await expect.poll(() => layout(page)).toEqual(before);

    const network = page.getByRole("combobox", {
      name: "Network",
      exact: true,
    });
    await network.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe("hidden");
    await expect.poll(() => layout(page)).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe("hidden");
    await expect.poll(() => layout(page)).toEqual(before);
    await expect(network).toBeFocused();
  }
});
