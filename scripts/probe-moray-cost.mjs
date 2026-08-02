/**
 * What W-L4b's two layers cost, measured rather than guessed.
 *
 *   node scripts/probe-moray-cost.mjs <tag>
 *
 * Same instrument as `probe-kelp.mjs` and for the same reason: rAF deltas
 * quantise to 16.66ms, so the frame is timed directly behind a one-pixel
 * `readPixels` barrier at a pinned render scale, and the with/without samples
 * are interleaved so the machine's drift runs through both arms. Read the
 * `paired` column and read `uptime` beside it.
 *
 * Two layers, toggled independently:
 * - `den` — the four sculpted den-mouth archways (`den-mouth` in the reef).
 * - `head` — every sculpted moray head plus its outline hull. What hiding it
 *   shows is the *gross* cost of the new head; the primitives it replaced are
 *   not in the frame to time, so the honest net is this figure minus what a
 *   ~1k-triangle primitive stack cost, which at these numbers is small.
 */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "C-close-moray-detection", position: [0, 2, 8], yaw: 0, pitch: -0.09 },
];
const SAMPLES = 24;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const rows = [];
for (const pose of POSES) {
  for (const layer of ["den", "head"]) {
    const result = await page.evaluate(
      async ({ pose, samples, layer }) => {
        const game = window.__reef;
        const renderer = game.renderer;
        renderer.pinRenderScale(1);

        const targets = [];
        game.scene.traverse((node) => {
          if (layer === "den" && node.name === "den-mouth") {
            targets.push(node);
          }
          if (layer === "head" && node.name === "moray-glb-head") {
            targets.push(node);
            // The hull shares the head's geometry and sits beside it.
            for (const sibling of node.parent.children) {
              if (sibling.name === "moray-outline" && sibling.geometry === node.geometry) {
                targets.push(sibling);
              }
            }
          }
        });
        if (targets.length === 0) {
          throw new Error(`no ${layer} meshes in the scene`);
        }

        game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });

        const gl = renderer.renderer.getContext();
        const pixel = new Uint8Array(4);
        const draw = (visible) => {
          for (const mesh of targets) {
            mesh.visible = visible;
          }
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
        for (const mesh of targets) {
          mesh.visible = true;
        }

        const median = (values) => {
          const sorted = [...values].sort((a, b) => a - b);
          return sorted[Math.floor(sorted.length / 2)];
        };
        let triangles = 0;
        for (const mesh of targets) {
          const index = mesh.geometry?.getIndex?.();
          if (index) {
            triangles += index.count / 3;
          }
        }
        return {
          withLayer: median(on),
          without: median(off),
          paired: median(on.map((value, i) => value - off[i])),
          meshes: targets.length,
          triangles,
        };
      },
      { pose, samples: SAMPLES, layer },
    );
    rows.push({ pose: pose.name, layer, ...result });
  }
}

console.log(`moray/den cost — ${tag}`);
console.log("pose                      layer   frame(ms)   without(ms)   paired(ms)");
for (const row of rows) {
  console.log(
    `${row.pose.padEnd(24)}  ${row.layer.padEnd(5)}  ${row.withLayer.toFixed(1).padStart(8)}   ` +
      `${row.without.toFixed(1).padStart(10)}   ${row.paired.toFixed(2).padStart(9)}` +
      `   (${row.meshes} meshes, ${row.triangles} tris)`,
  );
}

await browser.close();
