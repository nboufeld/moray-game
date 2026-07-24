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
  await expect(page.locator("#total-count")).toHaveText("4");

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
