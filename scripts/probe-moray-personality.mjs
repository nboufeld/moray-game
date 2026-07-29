/**
 * The five characters, photographed in their characteristic poses (W-M2).
 *
 *   node scripts/probe-moray-personality.mjs <tag>
 *
 * `probe-moray-presence.mjs` photographs the *states*; this probe photographs
 * the *characters* — one pose per species, chosen to be the one a player
 * would tell them apart by, at `probe-moray.mjs`'s own corridor poses:
 *
 * - the dragon fully extended, met head-on, staring back (the diver stands
 *   inside its look radius, so the settle is what raises the stare);
 * - the snowflake half-hidden, tucked into the den shadow;
 * - the ribbon mid-flourish, through the presence door's `ripple()` QA hook
 *   (the natural first ripple sits past the opening quiescence, minutes
 *   beyond any settle) — captured 1.2 s in, at the envelope's crest;
 * - the zebra mid-patrol, extended and scanning on its clockwork round.
 *
 * The abyss hermit is another package's animal; its profile is data here and
 * its portrait is that package's to take.
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 120_000;

const SAVE_KEY = "reef-between-seas.save.v1";
const ALL_SPECIES = ["snowflake-moray", "ribbon-moray", "zebra-moray", "dragon-moray"];

/** probe-moray.mjs's corridor poses, held so the three probes compare 1:1. */
const SHOTS = [
  {
    name: "K1-dragon-sovereign",
    species: "dragon-moray",
    state: "extended",
    camera: { position: [-6, 2.0, -4.6], yaw: 0, pitch: -0.04 },
    settle: 5,
  },
  {
    name: "K2-snowflake-halfhidden",
    species: "snowflake-moray",
    state: "tucked",
    camera: { position: [0, 1.75, 5.2], yaw: 0, pitch: -0.02 },
    settle: 5,
  },
  {
    name: "K3-ribbon-flourish",
    species: "ribbon-moray",
    // Extended, so there is a body's length out of the den for the ripple to
    // travel down — at "peeking" only the head shows and the flourish cannot.
    state: "extended",
    camera: { position: [-8.6, 2.0, 6.0], yaw: Math.PI / 2, pitch: -0.02 },
    settle: 5,
    // Start the flourish after the pose has settled, then advance to its crest.
    ripple: true,
  },
  {
    name: "K4-zebra-patrol",
    species: "zebra-moray",
    state: "extended",
    camera: { position: [8.6, 1.8, 6.0], yaw: -Math.PI / 2, pitch: -0.02 },
    settle: 5,
  },
];

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-moray-personality.mjs <tag>");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

// Warm-up load, so a cold dev server's re-optimize cannot blank a capture.
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

for (const shot of SHOTS) {
  // Fresh world per shot, with a completed save so the ceremony's plate
  // cannot cover the animal — probe-moray.mjs's own protocol.
  await page.evaluate(
    ([key, discovered]) =>
      window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
    [SAVE_KEY, ALL_SPECIES],
  );
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.waitForFunction(
    (species) => window.__morayPresence?.[species] !== undefined,
    shot.species,
  );

  await page.evaluate(
    ([species, state]) => window.__morayPresence[species].force(state),
    [shot.species, shot.state],
  );
  await page.evaluate((pose) => window.__reef.capture(pose), {
    ...shot.camera,
    settle: shot.settle,
  });

  if (shot.ripple) {
    await page.evaluate((species) => window.__morayPresence[species].ripple(), shot.species);
    await page.evaluate((pose) => window.__reef.capture(pose), { ...shot.camera, settle: 1.2 });
  }
  await page.waitForTimeout(250);

  const file = path.join(OUT_DIR, `tmp_${shot.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
