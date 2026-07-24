import { expect, type Page } from "@playwright/test";

/**
 * Forward swim that leaves the diver coasting to a stop about 7.5m from the
 * snowflake moray, roughly the middle of the 1.2m–14m focus band. The margin
 * matters: the browser only simulates while it renders, so a loaded machine
 * covers less ground in the same wall-clock time. Retuning `DiveController`'s
 * acceleration or drag means retuning this one number, not every diving spec.
 */
const SWIM_MS = 1600;

/**
 * Swims in from the spawn point and waits for the snowflake moray — the only
 * one placed straight ahead — to be focused and recorded.
 */
export async function swimToFirstDiscovery(page: Page): Promise<void> {
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(SWIM_MS);
  await page.keyboard.up("KeyW");
  await expect(page.locator("#found-count")).toHaveText("1", { timeout: 6000 });
}
