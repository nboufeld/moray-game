import { expect, test } from "@playwright/test";

test("the reef boots and renders a canvas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  const canvas = page.locator("#reef-canvas");
  await expect(canvas).toBeVisible();

  const size = await canvas.evaluate((el) => ({
    width: (el as HTMLCanvasElement).width,
    height: (el as HTMLCanvasElement).height,
  }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);

  await expect(page.getByTestId("objective")).toContainText("Find the morays");
  await expect(page.locator("#found-count")).toHaveText("0");
  // Seventeen since Wave 8 (nine morays + eight mythics) plus every streamed
  // region's findable residents — reserved in the total from boot so the
  // objective never wobbles with the streaming radius. The resident count is
  // read from the shipped region defs so this test tracks new regions.
  const expectedTotal = await page.evaluate(() => {
    type RegionLike = { codexEntries?: readonly unknown[] };
    const regions = (window as unknown as { __reefRegions: RegionLike[] }).__reefRegions;
    return 17 + regions.reduce((n, region) => n + (region.codexEntries?.length ?? 0), 0);
  });
  await expect(page.locator("#total-count")).toHaveText(String(expectedTotal));

  // The game instance is exposed for lightweight assertions.
  const hasGame = await page.evaluate(() => "__reef" in window);
  expect(hasGame).toBe(true);

  expect(errors).toEqual([]);
});

test("the codex opens and closes with the C key", async ({ page }) => {
  await page.goto("/");
  const codex = page.getByTestId("codex");
  await expect(codex).toBeHidden();

  await page.keyboard.press("KeyC");
  await expect(codex).toBeVisible();

  await page.keyboard.press("KeyC");
  await expect(codex).toBeHidden();
});
