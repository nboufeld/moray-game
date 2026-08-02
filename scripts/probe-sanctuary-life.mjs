/**
 * What the sanctuary's life costs, paired (W-L8).
 *
 *   PROBE_SCALE=0.34 node scripts/probe-sanctuary-life.mjs <tag>
 *
 * The kelp probe's instrument pointed at the `sanctuary-life` group inside
 * the sanctuary scene: the room *replaces* the reef render, so its cost is
 * read on its own, with the room open and the residents present.
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
const SCALE = Number(process.env.PROBE_SCALE ?? "0.34");
const SAMPLES = Number(process.env.PROBE_SAMPLES ?? "12");

const SAVE_KEY = "reef-between-seas.save.v1";
const ALL_SPECIES = ["snowflake-moray", "ribbon-moray", "zebra-moray", "dragon-moray"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(
  ([key, discovered]) =>
    window.localStorage.setItem(key, JSON.stringify({ version: 2, discovered, settings: {} })),
  [SAVE_KEY, ALL_SPECIES],
);
await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);
await page.keyboard.press("KeyV");

console.log(`sanctuary life cost — ${tag} (pinned scale ${SCALE}, ${SAMPLES} pairs)`);
console.log(execSync("uptime").toString().trim());

const result = await page.evaluate(
  async ({ samples, scale }) => {
    const game = window.__reef;
    const renderer = game.renderer;
    const life = game.sanctuary.scene.children.find((child) => child.name === "sanctuary-life");
    if (!life) {
      return null;
    }

    game.capture({ settle: 4 });
    renderer.pinRenderScale(scale);

    const gl = renderer.renderer.getContext();
    const pixel = new Uint8Array(4);
    const draw = () => {
      const start = performance.now();
      game.renderFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return performance.now() - start;
    };
    const median = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };

    draw();
    draw();
    const whole = [];
    for (let i = 0; i < samples; i++) {
      whole.push(draw());
    }

    life.visible = true;
    draw();
    life.visible = false;
    draw();
    const on = [];
    const off = [];
    for (let i = 0; i < samples; i++) {
      life.visible = true;
      on.push(draw());
      life.visible = false;
      off.push(draw());
    }
    life.visible = true;

    return { whole: median(whole), paired: median(on.map((value, i) => value - off[i])) };
  },
  { samples: SAMPLES, scale: SCALE },
);

if (!result) {
  console.error("sanctuary-life group not found");
} else {
  console.log(
    `whole sanctuary frame ${result.whole.toFixed(1)} ms | life paired ${result.paired.toFixed(2)} ms`,
  );
}
console.log(execSync("uptime").toString().trim());
await browser.close();
