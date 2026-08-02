/**
 * What the fish community costs and where each species actually is (W-L4).
 *
 *   node scripts/probe-fish-diversity.mjs <tag>
 *
 * Two measurements a screenshot cannot make:
 *
 * 1. Frame cost, `probe-kelp.mjs`'s way: `renderFrame()` timed directly with a
 *    one-pixel `readPixels` barrier after it, all five fish meshes hidden and
 *    shown on alternate samples, and the median of the *paired* differences
 *    reported — this machine is shared with other agents whose builds move the
 *    load average further than the fish cost, and interleaving is the only
 *    estimator that survives that. Reported at pinned scale 1 and at the
 *    adaptive scaler's 0.34 floor, because the budget is quoted at the floor
 *    and fill-bound work shrinks with it while draw calls do not.
 *
 * 2. Presence, `probe-fish.mjs`'s way: per species, how many instances the
 *    canonical cameras actually hold inside the frustum and the fog range,
 *    sampled over simulated time — a species can be tuned perfectly and still
 *    live entirely outside every shot.
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 * Read `uptime` beside every number.
 */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";

const POSES = [
  { name: "A-opening-hero", position: [0, 2, 22], yaw: 0, pitch: 0 },
  { name: "B-mid-depth-traverse", position: [10, 3, 12], yaw: 0.72, pitch: -0.1 },
  { name: "C-close-moray-detection", position: [0, 2, 8], yaw: 0, pitch: -0.09 },
  { name: "G-tidepool-close", position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25 },
];
const SAMPLES = 24;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const census = await page.evaluate(() => {
  // The fallback is what lets this probe measure the pre-W-L4 single-species
  // school from a baseline worktree, where `meshes` does not exist yet.
  const meshes = window.__reef.fish.meshes ?? [window.__reef.fish.mesh];
  return meshes.map((mesh) => {
    const index = mesh.geometry.getIndex();
    return {
      name: mesh.name,
      count: mesh.count,
      triangles: index ? (index.count / 3) * mesh.count : 0,
    };
  });
});
console.info(`fish community — ${tag}`);
for (const species of census) {
  console.info(
    `  ${species.name.padEnd(18)} ${String(species.count).padStart(4)} instances  ` +
      `${String(Math.round(species.triangles)).padStart(6)} triangles  1 draw call`,
  );
}
const totals = census.reduce(
  (sum, s) => ({ count: sum.count + s.count, triangles: sum.triangles + s.triangles }),
  { count: 0, triangles: 0 },
);
console.info(
  `  total: ${totals.count} instances, ${Math.round(totals.triangles)} triangles, ${census.length} draw calls`,
);

// --- presence: who is actually in each canonical frame -----------------------
// Skippable for baseline runs, where only the perf columns are comparable.
const presence = process.env.FISH_PROBE_PERF_ONLY
  ? []
  : await page.evaluate(
  async ({ poses }) => {
    const game = window.__reef;
    const camera = game.camera;
    const results = [];
    for (const pose of poses) {
      game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });
      // The render is not optional. `Vector3.project` reads the camera's
      // `matrixWorldInverse`, and three only refreshes that during a render —
      // which, inside a synchronous `evaluate`, never happens between
      // captures on its own. Without this line every pose after the first is
      // counted through the *previous* pose's view matrix: the first cut of
      // this probe reported the wrasse at 0% in shot A and all sixteen tangs
      // permanently in shot C, both of which are geometrically impossible,
      // and both of which are exactly what a stale view matrix produces.
      game.renderFrame();
      const meshes = game.fish.meshes;
      const probe = new (Object.getPrototypeOf(camera.position).constructor)();
      const perSpecies = meshes.map((mesh) => ({ name: mesh.name, seen: [] }));

      // 120 seconds of simulated time at 10Hz, counted against the frustum
      // and the range the fog leaves anything visible at.
      for (let s = 0; s < 1200; s++) {
        game.fish.update(1 / 10, false, camera.position);
        for (let m = 0; m < meshes.length; m++) {
          const array = meshes[m].instanceMatrix.array;
          let visible = 0;
          for (let i = 0; i < meshes[m].count; i++) {
            const o = i * 16;
            probe.set(array[o + 12], array[o + 13], array[o + 14]);
            if (probe.distanceTo(camera.position) > 24) {
              continue;
            }
            probe.project(camera);
            if (probe.z < 1 && Math.abs(probe.x) < 1 && Math.abs(probe.y) < 1) {
              visible++;
            }
          }
          perSpecies[m].seen.push(visible);
        }
      }

      results.push({
        pose: pose.name,
        species: perSpecies.map(({ name, seen }) => ({
          name,
          mean: seen.reduce((a, b) => a + b, 0) / seen.length,
          min: Math.min(...seen),
          max: Math.max(...seen),
          presentPercent: (seen.filter((v) => v > 0).length / seen.length) * 100,
        })),
      });
    }
    return results;
  },
  { poses: POSES },
);

console.info(`\npresence over 120 simulated seconds (inside frustum and fog range) — ${tag}`);
for (const result of presence) {
  console.info(`${result.pose}`);
  for (const species of result.species) {
    console.info(
      `  ${species.name.padEnd(18)} mean ${species.mean.toFixed(1).padStart(5)}  ` +
        `range ${String(species.min).padStart(2)}..${String(species.max).padEnd(3)} ` +
        `in frame ${species.presentPercent.toFixed(0).padStart(3)}% of the time`,
    );
  }
}

// --- frame cost, interleaved A/B at two pinned scales ------------------------
for (const scale of [1, 0.34]) {
  const rows = [];
  for (const pose of POSES) {
    const result = await page.evaluate(
      async ({ pose, samples, scale }) => {
        const game = window.__reef;
        const renderer = game.renderer;
        renderer.pinRenderScale(scale);
        game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });

        const meshes = game.fish.meshes ?? [game.fish.mesh];
        const gl = renderer.renderer.getContext();
        const pixel = new Uint8Array(4);
        const draw = (visible) => {
          for (const mesh of meshes) {
            mesh.visible = visible;
          }
          const start = performance.now();
          game.renderFrame();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          return performance.now() - start;
        };

        // Warm both programs before timing anything.
        draw(true);
        draw(false);

        const on = [];
        const off = [];
        for (let i = 0; i < samples; i++) {
          on.push(draw(true));
          off.push(draw(false));
        }
        for (const mesh of meshes) {
          mesh.visible = true;
        }

        const median = (values) => {
          const sorted = [...values].sort((a, b) => a - b);
          return sorted[Math.floor(sorted.length / 2)];
        };
        return {
          withFish: median(on),
          without: median(off),
          paired: median(on.map((value, i) => value - off[i])),
        };
      },
      { pose, samples: SAMPLES, scale },
    );
    rows.push({ pose: pose.name, ...result });
  }

  console.info(`\nfish cost at render scale ${scale} — ${tag}`);
  console.info("pose                      frame(ms)   without(ms)   paired(ms)");
  for (const row of rows) {
    console.info(
      `${row.pose.padEnd(24)}  ${row.withFish.toFixed(1).padStart(8)}   ` +
        `${row.without.toFixed(1).padStart(10)}   ${row.paired.toFixed(2).padStart(9)}`,
    );
  }
}

await browser.close();
