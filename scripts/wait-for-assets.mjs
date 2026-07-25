/**
 * Blocks a capture until the page's authored assets have settled.
 *
 * The reef is seeded and `Game.capture()` advances by whole fixed steps, so a
 * shot is reproducible frame for frame — but only for content the page already
 * has. A painted skin that lands one frame after the shutter turns a fast
 * machine and a slow one into two different pictures, and the difference looks
 * exactly like an art change.
 *
 * Local loads take milliseconds. The cap exists so a missing or wedged asset
 * costs a warning and a slightly duller eel rather than the whole run: the
 * game itself falls back to its procedural skins, so a shot taken anyway is
 * still a valid shot of something.
 */
const CAP_MS = 10_000;

export async function waitForAssets(page, capMs = CAP_MS) {
  try {
    await page.waitForFunction(() => window.__reef?.assetsReady === true, null, {
      timeout: capMs,
    });
  } catch {
    console.warn(`  authored assets unsettled after ${capMs}ms — capturing anyway`);
  }
}
