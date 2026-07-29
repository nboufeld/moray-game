/**
 * What the sky's slow moods cost (W-M1), measured the way the kelp probe
 * measures — renderFrame() behind a one-pixel readPixels barrier, interleaved
 * on/off pairs, median of the paired differences — with two arms per pose:
 *
 *   off  the identity mood ("bright-noon" pinned at 1): every consumer takes
 *        its early path, which is the state every canonical capture and the
 *        whole opening stretch of every dive renders in. The budget quoted
 *        against this arm is ≤ +0.3 ms.
 *   on   "golden-afternoon" pinned at 0.5 — mid-crossfade, the system's most
 *        expensive honest state: the fog and light hooks take the weather
 *        branch, the shafts and pools re-tint, the grade uniforms rewrite.
 *
 * Each draw is preceded by one game.advance(1/60), outside the timer, so the
 * shafts', caustics' and grade's own updates see the pinned channels the way
 * a live frame would; the timed renderFrame() is where the onBeforeRender
 * hooks actually run. The world advances equally in both arms, so its drift
 * is shared — the standing interleave argument.
 *
 * The probe also microbenches WeatherMoods.update() itself, on a throwaway
 * instance imported through the dev server, in the two states a live frame
 * can find it: holding a mood, and inside a scheduled crossfade (the 20-lerp
 * path). That number cannot be seen by the paired arms because the instance
 * under test is pinned there.
 *
 *   node scripts/probe-weather.mjs <tag>   (PROBE_SCALE=0.34 for the floor)
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
const scale = Number(process.env.PROBE_SCALE ?? 1);
const SAMPLES = 24;

const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "B-mid-depth-traverse", position: [10, 3, 12], yaw: 0.72, pitch: -0.1 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const rows = [];
for (const pose of POSES) {
  const result = await page.evaluate(
    async ({ pose, samples, scale }) => {
      const game = window.__reef;
      const renderer = game.renderer;

      // Pose after collection, pin after posing (Game.capture pins to 1).
      game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });
      renderer.pinRenderScale(scale);

      const gl = renderer.renderer.getContext();
      const pixel = new Uint8Array(4);
      const draw = (moodOn) => {
        if (moodOn) {
          game.setMood("golden-afternoon", 0.5);
        } else {
          game.setMood("bright-noon", 1);
        }
        game.advance(1 / 60);
        const start = performance.now();
        game.renderFrame();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return performance.now() - start;
      };

      draw(true);
      draw(false);
      const on = [];
      const off = [];
      for (let i = 0; i < samples; i++) {
        on.push(draw(true));
        off.push(draw(false));
      }
      game.setMood("bright-noon", 1);

      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      return {
        midCrossfade: median(on),
        identity: median(off),
        paired: median(on.map((value, i) => value - off[i])),
      };
    },
    { pose, samples: SAMPLES, scale },
  );
  rows.push({ pose: pose.name, ...result });
}

// The update() microbench, on a throwaway instance so the game's own weather
// clock is never advanced past its opening hold.
const bench = await page.evaluate(async () => {
  const { WeatherMoods } = await import("/src/rendering/WeatherMoods.ts");
  const iterations = 200_000;
  const time = (weather, dt) => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      weather.update(dt);
    }
    return ((performance.now() - start) / iterations) * 1e6; // ns per call
  };

  const holding = new WeatherMoods();
  const holdNs = time(holding, 1e-9);

  const fading = new WeatherMoods();
  while (fading.state.into === null) {
    fading.update(1);
  }
  const fadeNs = time(fading, 1e-9);
  return { holdNs, fadeNs };
});

console.log(`weather mood cost — ${tag} (scale ${scale})`);
console.log("pose                   identity(ms)   mid-fade(ms)   paired(ms)");
for (const row of rows) {
  console.log(
    `${row.pose.padEnd(22)} ${row.identity.toFixed(1).padStart(10)}   ${row.midCrossfade
      .toFixed(1)
      .padStart(12)}   ${row.paired.toFixed(2).padStart(9)}`,
  );
}
console.log(
  `WeatherMoods.update(): ${bench.holdNs.toFixed(0)} ns holding, ${bench.fadeNs.toFixed(0)} ns mid-fade`,
);
console.log(execSync("uptime").toString().trim());

await browser.close();
