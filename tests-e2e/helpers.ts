import { expect, type Page } from "@playwright/test";

/**
 * Where to stop swimming. The snowflake moray sits at z = 1.5 and focus needs
 * a range of 1.2m–14m, so releasing here leaves the diver coasting to a stop
 * comfortably inside that band.
 */
const RELEASE_AT_Z = 9;

declare global {
  interface Window {
    __reef?: { divePosition: { x: number; y: number; z: number } };
  }
}

/**
 * Swims in from the spawn point and waits for the snowflake moray — the only
 * one placed straight ahead — to be focused and recorded.
 *
 * This waits on the diver's actual position rather than holding the key for a
 * fixed time. The world only advances while the browser is drawing, so on a
 * machine rasterising in software a timed swim covers a fraction of the
 * distance and the moray never comes into focus range.
 */
export async function swimToFirstDiscovery(page: Page): Promise<void> {
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(
      (stopAt) => (window.__reef?.divePosition.z ?? Infinity) <= stopAt,
      RELEASE_AT_Z,
      { timeout: 30_000 },
    );
  } finally {
    await page.keyboard.up("KeyW");
  }

  await expect(page.locator("#found-count")).toHaveText("1", { timeout: 20_000 });
}
