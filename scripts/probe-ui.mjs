/**
 * Every DOM surface the game can put on screen, one screenshot each.
 *
 *   node scripts/probe-ui.mjs <tag>
 *
 * The canonical shot set holds exactly two UI frames — D opens the comfort
 * panel and E opens the sanctuary — which between them miss the codex, the
 * discovery plate, the keyboard focus ring and the reticle's focusing state.
 * Those are four of the six things a restyle can break, and none of them is
 * visible in a shot nobody takes. This walks all of them at the same viewport
 * the shot set uses, so the two sets can be read side by side.
 *
 * Two states here are posed rather than played: the plate is raised through the
 * same `Hud.showDiscovery` the discovery handler calls, and the reticle is put
 * into its focusing state by hand. Swimming to a real discovery takes seconds
 * of rendered frames and lands the diver somewhere slightly different every
 * run, which is exactly what a style comparison cannot have.
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

/** The reef behind the UI: bright sand and open water, the hardest ground for pale paper. */
const POSE = { position: [0, 2, 18], yaw: 0, pitch: -0.05, settle: 2 };

const STATES = [
  {
    name: "U1-hud-idle",
    description: "objective card, controls card, resting reticle",
  },
  {
    name: "U2-reticle-focusing",
    description: "the focus ring part-filled on a moray",
    async after(page) {
      await page.evaluate(() => {
        document.getElementById("reticle").classList.add("is-focusing");
        // 0.62 of the way round, written the way `Hud.setFocus` writes it.
        document.getElementById("reticle-fill").style.strokeDashoffset = String(
          2 * Math.PI * 20 * 0.38,
        );
      });
    },
  },
  {
    name: "U3-discovery-plate",
    description: "the ceremony's name plate at full hold",
    async after(page) {
      // The same call `Game.onDiscovered` makes. `capture()` has already
      // stopped the loop, so nothing ticks the plate's timer down and the
      // plate stays up indefinitely — but the *animation* clock only advances
      // when the page paints, and with the render loop stopped it runs at a
      // fraction of wall speed. A fixed wait screenshots a plate that is still
      // at nought opacity, so wait for the rise to finish instead.
      await page.evaluate(() =>
        window.__reef.hud.showDiscovery("Snowflake moray", "Echidna nebulosa"),
      );
      await page.waitForFunction(
        () => window.getComputedStyle(document.getElementById("discovery-toast")).opacity === "1",
      );
    },
  },
  {
    name: "U4-codex-open",
    description: "the codex with four cards and their plates",
    seedDiscoveries: true,
    keys: ["KeyC"],
  },
  {
    name: "U5-settings-focus",
    description: "the comfort panel with the keyboard ring on its first control",
    keys: ["KeyO"],
    async after(page) {
      // Tab rather than `.focus()`: `:focus-visible` is the thing under test,
      // and only a keyboard-driven focus is guaranteed to match it.
      await page.keyboard.press("Tab");
    },
  },
  {
    name: "U6-settings-calm-on",
    description: "the Calm Mode preset applied, so its button is in its on state",
    keys: ["KeyO"],
    async after(page) {
      await page.locator("#settings-calm").click();
    },
  },
];

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-ui.mjs <tag>");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

// Warm-up load: a cold dev server can re-optimize dependencies and reload the
// page mid-capture, which screenshots as a blank canvas.
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);

for (const state of STATES) {
  if (state.seedDiscoveries) {
    await page.evaluate(
      ([key, discovered]) =>
        window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
      [SAVE_KEY, ALL_SPECIES],
    );
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  } else {
    await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  }
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);

  for (const key of state.keys ?? []) {
    await page.keyboard.press(key);
  }

  await page.evaluate((pose) => window.__reef.capture(pose), POSE);
  await state.after?.(page);
  // Let the held frame reach the compositor before grabbing it.
  await page.waitForTimeout(250);

  const file = path.join(OUT_DIR, `tmp_${state.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)} — ${state.description}`);
}

await browser.close();
