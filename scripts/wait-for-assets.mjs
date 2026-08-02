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

/**
 * Fails every authored asset request, so the page builds the world it would
 * build with no `public/assets` directory at all.
 *
 * That build is a shipping configuration, not a curiosity — the loaders never
 * throw and every surface keeps the procedural map it was constructed with — so
 * it has to be looked at whenever the painted ones change, and it is the only
 * way to see the fallbacks at all now that every one of them is covered by a
 * file. Blocking at the network is how to look without moving anything on disk:
 * nothing is renamed, the next run needs no cleanup, and an aborted request is
 * exactly the error path the library already handles.
 *
 * Set `SHOT_NO_ASSETS=1` to turn it on in `capture-shots.mjs` and
 * `measure-frames.mjs`.
 */
export async function blockAssets(page) {
  await page.route("**/assets/**", (route) => route.abort());
}

/** Whether the harnesses should run in that mode. */
export const noAssets = process.env.SHOT_NO_ASSETS === "1";
