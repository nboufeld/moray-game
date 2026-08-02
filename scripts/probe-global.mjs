/**
 * The whole game's ledger, measured in one sitting (W-L8).
 *
 *   PROBE_SCALE=0.34 node scripts/probe-global.mjs <tag>
 *
 * Round L's packages each measured their own layer with their own probe, on
 * whatever machine contention they were dealt. This is the same instrument —
 * `renderFrame()` timed behind a one-pixel `readPixels` barrier at a pinned
 * scale, interleaved on/off pairs, median of the paired differences — pointed
 * at every named system at once, so the global ledger's rows all come from
 * the same session, the same load, and the same pose. It also prints the
 * whole-frame median per pose with everything visible, which is the number
 * the per-system rows have to be read against.
 *
 * Read `uptime` (printed) beside every figure, as always.
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
/** 1 to compare against the probe-kelp/flora history, 0.34 for the settled floor. */
const SCALE = Number(process.env.PROBE_SCALE ?? "0.34");
const SAMPLES = Number(process.env.PROBE_SAMPLES ?? "10");

const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "B-mid-depth-traverse", position: [10, 3, 12], yaw: 0.72, pitch: -0.1 },
  { name: "C-close-moray", position: [0, 2, 8], yaw: 0, pitch: -0.09 },
  { name: "G-tidepool-close", position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25 },
];

/**
 * Each row is one toggle: every scene node whose name is in the list is
 * hidden together, so a "system" is measured the way its package shipped it.
 * The moray heads' figure is gross — hiding the GLB head does not re-show the
 * primitive stack it replaced — and the den row is gross the same way.
 */
const SYSTEMS = [
  { name: "coral-garden", nodes: ["staghorn", "brain", "plateStack", "tube", "fan", "branch", "boulder", "polyp"] },
  { name: "kelp", nodes: ["kelp"] },
  { name: "sea-grass", nodes: ["sea-grass"] },
  { name: "seaweed", nodes: ["seaweed"] },
  { name: "distant-reef", nodes: ["distant-reef"] },
  { name: "fish-community", nodes: ["fish-fusilier", "fish-needlefish", "fish-tang", "fish-damsel", "fish-wrasse"] },
  { name: "ground-fauna", nodes: ["crabs", "starfish", "urchins", "anemone-garden", "shrimp"] },
  { name: "den-dressing", nodes: ["den-mouth"] },
  { name: "moray-glb-heads", nodes: ["moray-glb-head"] },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

console.log(`global ledger — ${tag} (pinned scale ${SCALE}, ${SAMPLES} pairs)`);
console.log(execSync("uptime").toString().trim());

for (const pose of POSES) {
  const result = await page.evaluate(
    async ({ pose, samples, systems, scale }) => {
      const game = window.__reef;
      const renderer = game.renderer;

      // Collect every named node once, from the whole scene: the coral
      // buckets live under the reef's group, the fauna on the scene root.
      const found = new Map();
      game.scene.traverse((child) => {
        for (const system of systems) {
          if (system.nodes.includes(child.name)) {
            const list = found.get(system.name) ?? [];
            list.push(child);
            found.set(system.name, list);
          }
        }
      });

      // Pin *after* posing: `capture()` pins the scale to 1 for its own
      // screenshot contract and would silently undo an earlier pin.
      game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });
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

      // Whole frame first, everything visible.
      draw();
      draw();
      const whole = [];
      for (let i = 0; i < samples; i++) {
        whole.push(draw());
      }

      const rows = [];
      for (const system of systems) {
        const nodes = found.get(system.name);
        if (!nodes || nodes.length === 0) {
          rows.push({ name: system.name, paired: NaN, count: 0 });
          continue;
        }
        const show = (visible) => {
          for (const node of nodes) {
            node.visible = visible;
          }
        };
        show(true);
        draw();
        show(false);
        draw();

        const on = [];
        const off = [];
        for (let i = 0; i < samples; i++) {
          show(true);
          on.push(draw());
          show(false);
          off.push(draw());
        }
        show(true);
        rows.push({
          name: system.name,
          paired: median(on.map((value, i) => value - off[i])),
          count: nodes.length,
        });
      }
      return { whole: median(whole), rows };
    },
    { pose, samples: SAMPLES, systems: SYSTEMS, scale: SCALE },
  );

  console.log(`\n${pose.name} — whole frame ${result.whole.toFixed(1)} ms`);
  for (const row of result.rows) {
    console.log(
      `  ${row.name.padEnd(16)} paired ${row.paired.toFixed(2).padStart(7)} ms  (${row.count} nodes)`,
    );
  }
}

console.log(`\n${execSync("uptime").toString().trim()}`);
await browser.close();
