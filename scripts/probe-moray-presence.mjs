/**
 * The den life, photographed state by state (W-L7).
 *
 *   node scripts/probe-moray-presence.mjs <tag>
 *
 * The presence cycle runs on a minutes-long clock with a 110 s opening hold,
 * so no capture settle ever catches a state on its own — which is the point
 * of the hold (the canonical set stays quiescent) and the reason this probe
 * exists. It stands at `probe-moray.mjs`'s own poses and drives the states
 * through the `window.__morayPresence` door each reef moray hangs once its
 * cycle engages: tucked, peeking (the authored pose, for reference), and
 * extended for the snowflake and the zebra, plus a startle aftermath with
 * its silt kicked through `window.__sandPuffs`.
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

/** probe-moray.mjs's corridor poses, held so the two probes compare 1:1. */
const CAMERAS = {
  snowflake: { position: [0, 1.75, 5.2], yaw: 0, pitch: -0.02 },
  zebra: { position: [8.6, 1.8, 6.0], yaw: -Math.PI / 2, pitch: -0.02 },
  dragon: { position: [-6, 2.0, -4.6], yaw: 0, pitch: -0.04 },
};

/** Where the startle silt kicks: forward of each den anchor along its facing
 * and below the head — Moray's own PUFF_FORWARD/PUFF_DROP arithmetic, with
 * the SPOT_PLACEMENTS literals baked in (snowflake faces +z, zebra −x). */
const PUFFS = {
  snowflake: [0, 1.1, 1.95],
  zebra: [12.55, 1.1, 6],
};

const SHOTS = [
  { name: "P1-snowflake-peek", camera: CAMERAS.snowflake, species: "snowflake-moray", state: "peeking" },
  { name: "P2-snowflake-tucked", camera: CAMERAS.snowflake, species: "snowflake-moray", state: "tucked" },
  { name: "P3-snowflake-extended", camera: CAMERAS.snowflake, species: "snowflake-moray", state: "extended" },
  { name: "P4-zebra-extended", camera: CAMERAS.zebra, species: "zebra-moray", state: "extended" },
  { name: "P5-dragon-extended", camera: CAMERAS.dragon, species: "dragon-moray", state: "extended" },
  {
    name: "P6-snowflake-startled",
    camera: CAMERAS.snowflake,
    species: "snowflake-moray",
    state: "startled",
    puffAt: PUFFS.snowflake,
  },
  {
    name: "P7-zebra-startle-puff",
    camera: CAMERAS.zebra,
    species: "zebra-moray",
    state: "startled",
    puffAt: PUFFS.zebra,
  },
];

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-moray-presence.mjs <tag>");
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
  // The presence door hangs once the cycle engages, 2.5 simulated seconds in.
  await page.waitForFunction(
    (species) => window.__morayPresence?.[species] !== undefined,
    shot.species,
  );

  // Force the state, then settle long enough for the ease to finish — the
  // machine's slowest transition is a few seconds of exponential glide.
  await page.evaluate(
    ([species, state]) => window.__morayPresence[species].force(state),
    [shot.species, shot.state],
  );
  await page.evaluate((pose) => window.__reef.capture(pose), { ...shot.camera, settle: 5 });

  if (shot.puffAt) {
    // Kick the silt the startle would have thrown, then advance a beat into
    // the billow: a puff is brightest around half a second old.
    await page.evaluate((at) => window.__sandPuffs.puff(at[0], at[1], at[2], 1.1), shot.puffAt);
    await page.evaluate((pose) => window.__reef.capture(pose), { ...shot.camera, settle: 0.5 });
  }
  await page.waitForTimeout(250);

  const file = path.join(OUT_DIR, `tmp_${shot.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
