/**
 * What a visitor costs while it is on stage, measured rather than guessed.
 *
 *   node scripts/probe-visitors.mjs <tag>
 *
 * Same harness as `probe-kelp.mjs`, because the same lie is waiting: rAF
 * deltas quantise to 16.66ms and the machine's load drifts by more than a
 * visitor costs. So each visitor is summoned mid-pass through the QA hook,
 * the world is held by `capture()`, and `renderFrame()` is timed directly
 * behind a one-pixel `readPixels` barrier — with-and-without interleaved per
 * sample, and the median of the paired differences is the number. It also
 * reports where the animal actually is, and how many degrees of frame it
 * spans, because "the shot is empty" and "there is no visitor" look the same
 * from a screenshot. Read `uptime` beside every figure.
 */
import { execSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";

/** The H-visitor-arc pose: the open water every crossing is judged in. */
const POSE = { position: [10, 3, 12], yaw: 0.72, pitch: -0.1 };
/** Mid-pass leads, so each animal is measured at full presence. */
const VISITORS = [
  { kind: "turtle", secondsIn: 20 },
  { kind: "ray", secondsIn: 18 },
  { kind: "jelly-bloom", secondsIn: 50 },
];
const SAMPLES = 24;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

console.log(`visitor cost — ${tag}`);
console.log(execSync("uptime").toString().trim());

const rows = [];
for (const visitor of VISITORS) {
  // A fresh world per visitor: passes must not stack, and the schedule's own
  // clock must start from zero so nothing else wanders on stage.
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);

  const result = await page.evaluate(
    async ({ visitor, pose, samples }) => {
      const game = window.__reef;
      game.renderer.pinRenderScale(1);
      window.__reefVisitors.summon(visitor.kind, visitor.secondsIn);
      game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });

      const group = game.scene.children.find((child) => child.name === visitor.kind);
      if (!group || group.children.length === 0) {
        throw new Error(`${visitor.kind} did not arrive`);
      }

      const gl = game.renderer.renderer.getContext();
      const pixel = new Uint8Array(4);
      const draw = (visible) => {
        group.visible = visible;
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
      group.visible = true;

      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };

      let triangles = 0;
      let draws = 0;
      group.traverse((node) => {
        const index = node.geometry?.getIndex?.();
        if (index) {
          triangles += index.count / 3;
          draws += Array.isArray(node.material) ? node.material.length : 1;
        } else if (node.geometry) {
          triangles += node.geometry.getAttribute("position").count / 3;
          draws += 1;
        }
      });

      const body = group.children[0];
      const camera = game.camera;
      const distance = body.position.distanceTo(camera.position);

      return {
        withVisitor: median(on),
        without: median(off),
        paired: median(on.map((value, i) => value - off[i])),
        triangles,
        draws,
        position: body.position.toArray().map((v) => v.toFixed(1)),
        distance: distance.toFixed(1),
      };
    },
    { visitor, pose: POSE, samples: SAMPLES },
  );
  rows.push({ kind: visitor.kind, ...result });

  // A pose per visitor, because the canonical set holds only the turtle's
  // crossing: the ray and the bloom are in no shot at all without this.
  const file = `visual-qa/tmp_${visitor.kind}-probe_${tag}.png`;
  await page.waitForTimeout(250);
  await page.screenshot({ path: file });
  console.log(`  posed ${file}`);
}

console.log("visitor        frame(ms)  without(ms)  paired(ms)  tris  draws  at              dist(m)");
for (const row of rows) {
  console.log(
    `${row.kind.padEnd(12)}  ${row.withVisitor.toFixed(1).padStart(8)}  ${row.without
      .toFixed(1)
      .padStart(10)}  ${row.paired.toFixed(2).padStart(9)}  ${String(row.triangles).padStart(5)}  ${String(
      row.draws,
    ).padStart(4)}  (${row.position.join(", ")})  ${row.distance.padStart(6)}`,
  );
}

await browser.close();
