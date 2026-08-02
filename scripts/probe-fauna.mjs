/**
 * What the ground fauna looks like up close, and what it costs.
 *
 *   node scripts/probe-fauna.mjs <tag>
 *
 * The canonical cameras stand ten to twenty metres from animals that are ten
 * centimetres long, so none of W-L5's populations can be judged from the shot
 * set alone — this walks up to each one the way `probe-moray.mjs` walks up to
 * the heads. The crab, starfish and shrimp standpoints are computed from the
 * live instance matrices rather than authored, because a guessed camera two
 * metres from a seeded scatter stands inside a coral head as often as not
 * (both of this probe's first authored poses did). It also drives the
 * clownfish moment: one pose outside the pair's emerge range (weaving over
 * the crowns) and one inside their hide range (buried in the tentacles) — the
 * behaviour is the deliverable and a single frame cannot show a hysteresis.
 *
 * The cost half is `probe-kelp.mjs`'s method: `renderFrame()` timed behind a
 * one-pixel `readPixels` barrier, all five fauna groups hidden and shown in
 * interleaved pairs, median of the per-pair differences — at a pinned scale
 * of 1 *and* at the adaptive scaler's 0.34 floor, which is the resolution the
 * budget is quoted at. Read `uptime` beside every number.
 */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const tag = process.argv[2] ?? "current";
const GROUPS = ["crabs", "starfish", "urchins", "anemone-garden", "shrimp"];

const PERF_POSES = [
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

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

/** First-instance world position of a named fauna mesh, off the live scene. */
async function instancePosition(groupName, index = 0) {
  return page.evaluate(
    ({ groupName, index }) => {
      const game = window.__reef;
      const group = game.scene.children.find((child) => child.name === groupName);
      let found = null;
      group?.traverse((node) => {
        if (!found && node.isInstancedMesh) {
          const m = node.instanceMatrix.array;
          found = { x: m[index * 16 + 12], y: m[index * 16 + 13], z: m[index * 16 + 14] };
        }
      });
      return found;
    },
    { groupName, index },
  );
}

/** A pose standing `back` off the target (world axes) and aimed at it. */
function aimed(name, target, back, settle) {
  const position = [target.x + back[0], target.y + back[1], target.z + back[2]];
  const dx = target.x - position[0];
  const dy = target.y - position[1];
  const dz = target.z - position[2];
  return {
    name,
    position,
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
    settle,
  };
}

// Crab 3 has the most open doorstep (south of the eastern bommie); the
// others live against coral that walls off any level standpoint.
const crab = await instancePosition("crabs", 3);
const star = await instancePosition("starfish", 3);
const shrimp = await instancePosition("shrimp");

const portraits = [
  // 5.2m from the garden centre: outside EMERGE_RANGE, the pair is out.
  { name: "anemones-fish-out", position: [7.5, 1.4, 13.7], yaw: 0, pitch: -0.18, settle: 8 },
  // 3.7m: the closest the player can watch from without spooking them —
  // this is the distance the delight is actually tuned for.
  { name: "anemones-fish-watch", position: [7.5, 1.1, 12.2], yaw: 0, pitch: -0.12, settle: 9 },
  // 2.0m: inside HIDE_RANGE, the pair is down in the crowns.
  { name: "anemones-fish-hidden", position: [7.5, 1.3, 10.5], yaw: 0, pitch: -0.35, settle: 6 },
];
if (crab) {
  // Nearly straight down: a crab on sand is unmissable from above, and no
  // coral head can wander into a vertical sightline.
  portraits.push(aimed("crab-doorstep", crab, [0.05, 2.2, 0.4], 11));
}
if (star) {
  portraits.push(aimed("starfish-drape", star, [0.4, 1.1, 2.0], 2));
}
portraits.push({
  name: "urchins-stack-foot",
  position: [15.6, 1.1, -0.6],
  yaw: 0,
  pitch: -0.3,
  settle: 2,
});
if (shrimp) {
  portraits.push(aimed("shrimp-station", shrimp, [0.35, 0.3, 0.9], 3));
}

// `PROBE_PERF_ONLY=1` skips the portraits: the cost pass is the one that
// wants a quiet machine, and re-shooting six poses is a minute of load.
const perfOnly = Boolean(process.env.PROBE_PERF_ONLY);

for (const pose of perfOnly ? [] : portraits) {
  await page.evaluate((p) => {
    window.__reef.capture({ position: p.position, yaw: p.yaw, pitch: p.pitch, settle: p.settle });
  }, pose);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `visual-qa/fauna-${pose.name}_${tag}.png` });
  console.log(`captured visual-qa/fauna-${pose.name}_${tag}.png`);
}

// Report where the clownfish actually are after the last pose, not just pixels.
const fishReport = perfOnly ? "" : await page.evaluate(() => {
  const game = window.__reef;
  const garden = game.scene.children.find((child) => child.name === "anemone-garden");
  const fish = garden?.children.find((child) => child.name === "clownfish");
  if (!fish) {
    return "no clownfish mesh";
  }
  const m = fish.instanceMatrix.array;
  return `clownfish at (${m[12].toFixed(2)}, ${m[13].toFixed(2)}, ${m[14].toFixed(2)}) and (${m[28].toFixed(2)}, ${m[29].toFixed(2)}, ${m[30].toFixed(2)})`;
});
if (fishReport) {
  console.log(fishReport);
}

// `PROBE_SKIP_PERF=1` reruns the portraits without paying for the cost pass —
// the numbers are only worth taking on a quiet machine anyway.
if (process.env.PROBE_SKIP_PERF) {
  await browser.close();
  process.exit(0);
}

const rows = [];
for (const scale of [1, 0.34]) {
  for (const pose of PERF_POSES) {
    const result = await page.evaluate(
      async ({ pose, samples, groups, scale }) => {
        const game = window.__reef;
        const renderer = game.renderer;
        renderer.pinRenderScale(scale);

        const fauna = game.scene.children.filter((child) => groups.includes(child.name));
        if (fauna.length !== groups.length) {
          throw new Error(`expected ${groups.length} fauna groups, found ${fauna.length}`);
        }

        game.capture({ position: pose.position, yaw: pose.yaw, pitch: pose.pitch, settle: 1 });
        renderer.pinRenderScale(scale);

        const gl = renderer.renderer.getContext();
        const pixel = new Uint8Array(4);
        const draw = (visible) => {
          for (const group of fauna) {
            group.visible = visible;
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
        for (const group of fauna) {
          group.visible = true;
        }

        const median = (values) => {
          const sorted = [...values].sort((a, b) => a - b);
          return sorted[Math.floor(sorted.length / 2)];
        };

        let triangles = 0;
        let draws = 0;
        for (const group of fauna) {
          group.traverse((node) => {
            const index = node.geometry?.getIndex?.();
            if (index) {
              const instances = node.count ?? 1;
              triangles += (index.count / 3) * instances;
              draws++;
            }
          });
        }

        return {
          withFauna: median(on),
          without: median(off),
          paired: median(on.map((value, i) => value - off[i])),
          triangles,
          draws,
        };
      },
      { pose, samples: SAMPLES, groups: GROUPS, scale },
    );
    rows.push({ pose: pose.name, scale, ...result });
  }
}

console.log(`\nground fauna cost — ${tag}`);
console.log("pose                      scale   frame(ms)   without(ms)   paired(ms)");
for (const row of rows) {
  console.log(
    `${row.pose.padEnd(24)}  ${String(row.scale).padStart(5)}   ${row.withFauna
      .toFixed(1)
      .padStart(8)}   ${row.without.toFixed(1).padStart(10)}   ${row.paired
      .toFixed(2)
      .padStart(9)}`,
  );
}
const first = rows[0];
if (first) {
  console.log(
    `\n${first.draws} fauna draw calls, ${Math.round(first.triangles)} instanced triangles`,
  );
}

await browser.close();
