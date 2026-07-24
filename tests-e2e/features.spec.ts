import { expect, test } from "@playwright/test";
import { swimToFirstDiscovery } from "./helpers";

test("the sanctuary can be entered and exited with the V key", async ({ page }) => {
  await page.goto("/?reset=1");
  const overlay = page.getByTestId("sanctuary-overlay");
  await expect(overlay).toBeHidden();

  await page.keyboard.press("KeyV");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("Dream Sanctuary");

  await page.keyboard.press("KeyV");
  await expect(overlay).toBeHidden();
});

test("Calm Mode preset updates the comfort toggles", async ({ page }) => {
  await page.goto("/?reset=1");

  await page.keyboard.press("KeyO");
  const panel = page.getByTestId("settings-panel");
  await expect(panel).toBeVisible();

  await page.locator("#settings-calm").click();

  await expect(page.locator("#opt-bob")).not.toBeChecked();
  await expect(page.locator("#opt-roll")).not.toBeChecked();
  await expect(page.locator("#opt-autolevel")).toBeChecked();
  await expect(page.locator("#opt-reduced")).toBeChecked();
  await expect(page.locator("#settings-calm")).toContainText("Calm Mode on");
});

test("discoveries and settings persist across a reload (save system)", async ({ page }) => {
  // Fresh dive, discover the straight-ahead moray.
  await page.goto("/?reset=1");
  await page.locator("#reef-canvas").click();
  await swimToFirstDiscovery(page);

  // Change a comfort setting so we can verify it persists too.
  await page.keyboard.press("KeyO");
  await page.locator("#opt-reduced").check();
  await page.keyboard.press("KeyO");

  // Reload WITHOUT the reset flag: the save should be restored.
  await page.goto("/");
  await expect(page.locator("#found-count")).toHaveText("1");

  await page.keyboard.press("KeyC");
  await expect(page.getByTestId("codex")).toContainText("Echidna nebulosa");
  await page.keyboard.press("KeyC");

  await page.keyboard.press("KeyO");
  await expect(page.locator("#opt-reduced")).toBeChecked();
});
