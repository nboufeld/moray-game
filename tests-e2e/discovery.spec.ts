import { expect, test } from "@playwright/test";
import { swimToFirstDiscovery } from "./helpers";

test("the moray is discovered by swimming toward it and holding focus", async ({ page }) => {
  await page.goto("/?reset=1");

  // Give focus to the game (also requests pointer lock; harmless in tests).
  await page.locator("#reef-canvas").click();

  // Swim in from open water, then hold still and let the focus ring fill.
  await swimToFirstDiscovery(page);
  await expect(page.getByTestId("discovery-toast")).toContainText("Snowflake moray");

  // The discovery is reflected on the exposed game instance too.
  const discovered = await page.evaluate(() => {
    const g = (window as unknown as { __reef?: { discoveredCount: number } }).__reef;
    return g?.discoveredCount ?? 0;
  });
  expect(discovered).toBe(1);

  // And it appears in the Codex.
  await page.keyboard.press("KeyC");
  await expect(page.getByTestId("codex")).toContainText("Echidna nebulosa");
});
