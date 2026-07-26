/**
 * Light-effects probe: what each of the four additive layers is actually worth.
 *
 *   node scripts/probe-light.mjs <tag>
 *
 * The caustics, the shafts, the bubbles and the motes are all faint additive
 * marks laid over a bright frame, which makes them the subject a whole-frame
 * screenshot is worst at: "are there dapples on the sand" is a question about
 * a few parts in 255 spread over a large area, and the eye reading a 1600px
 * screenshot cannot tell "too faint" from "not drawing at all". Both look like
 * sand. So each layer is measured the way `probe-fish.mjs` measures the school:
 * the pose is rendered twice, once with the layer hidden, and the difference is
 * an exact per-pixel mask of what that layer put on the screen.
 *
 * Read the coverage and the p90 together. A layer that covers a lot of pixels
 * at a delta of one or two is a wash nobody will see; a layer that covers very
 * few at a large delta is a hard-edged mark. A dapple wants a good fraction of
 * the sand at a delta the eye can find.
 *
 * The second half walks shot A through simulated time, because two of these
 * layers only exist in motion: bubbles rise and motes twinkle, and one frame
 * cannot show either.
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

const POSES = [
  { name: "A-opening-hero", pose: { position: [0, 2, 22], yaw: 0, pitch: 0, settle: 2 } },
  { name: "B-mid-depth-traverse", pose: { position: [10, 3, 12], yaw: 0.72, pitch: -0.1, settle: 3 } },
  // Straight down at the sand from swimming height: the dapples' own camera.
  // Neither canonical shot looks at the seabed square-on, and a layer painted
  // on the floor seen at a grazing angle is a layer measured through its worst
  // case.
  { name: "S-sand-below", pose: { position: [2, 3.2, 10], yaw: 0.2, pitch: -0.75, settle: 2 } },
];

/** Simulated seconds into shot A, for the layers that only exist in motion. */
const MOMENTS = [2, 5, 9, 14];

/**
 * How far a channel has to move between the two renders for a pixel to count as
 * the layer's. Above the frame's own dither, below anything worth seeing.
 */
const MASK_THRESHOLD = 2;

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-light.mjs <tag>");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

/**
 * Everything below runs in the page. `__reef` is the `Game`; TypeScript's
 * `private` is a compile-time fiction, so its systems are all reachable from
 * here — which is what lets a probe be written without opening holes in the
 * game's API for it.
 */
const measure = await page.evaluate(
  async ({ poses, threshold }) => {
    const game = window.__reef;
    const gl = game.renderer.renderer.getContext();

    const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const grab = () => {
      game.renderFrame();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { width, height, pixels };
    };

    const quantile = (sorted, q) =>
      sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

    // The layers, each as the object whose `visible` flag takes it out of the
    // frame. The caustics' second sheet is a child of the first, so hiding the
    // parent hides both. A missing layer is skipped rather than fatal, so the
    // same probe runs against the revision a change is being compared with.
    const layers = () =>
      [
        { name: "caustics", object: game.caustics?.mesh },
        { name: "shafts", object: game.shafts?.group },
        { name: "bubbles", object: game.bubbles?.mesh },
        { name: "motes", object: game.particles?.points },
      ].filter((layer) => layer.object);

    const results = [];
    for (const entry of poses) {
      game.capture(entry.pose);
      const full = grab();
      const total = full.width * full.height;

      const layerStats = [];
      for (const layer of layers()) {
        layer.object.visible = false;
        const without = grab();
        layer.object.visible = true;

        const deltas = [];
        let warmth = 0;
        for (let i = 0; i < full.pixels.length; i += 4) {
          const dr = full.pixels[i] - without.pixels[i];
          const dg = full.pixels[i + 1] - without.pixels[i + 1];
          const db = full.pixels[i + 2] - without.pixels[i + 2];
          if (Math.abs(dr) < threshold && Math.abs(dg) < threshold && Math.abs(db) < threshold) {
            continue;
          }
          deltas.push(luminance(dr, dg, db));
          // Positive means the layer put more red in the frame than blue,
          // which is the whole of "is this light warm".
          warmth += dr - db;
        }
        const sorted = deltas.slice().sort((a, b) => a - b);
        layerStats.push({
          name: layer.name,
          coverage: (deltas.length / total) * 100,
          p50: quantile(sorted, 0.5),
          p90: quantile(sorted, 0.9),
          p99: quantile(sorted, 0.99),
          max: sorted[sorted.length - 1] ?? 0,
          warmth: deltas.length > 0 ? warmth / deltas.length : 0,
        });
      }

      // The frame's own value spread, so a layer's delta can be read against
      // what it is being added to.
      const frameLum = [];
      for (let i = 0; i < full.pixels.length; i += 4 * 37) {
        frameLum.push(luminance(full.pixels[i], full.pixels[i + 1], full.pixels[i + 2]));
      }
      frameLum.sort((a, b) => a - b);

      results.push({
        name: entry.name,
        layers: layerStats,
        frame: {
          p10: quantile(frameLum, 0.1),
          p50: quantile(frameLum, 0.5),
          p90: quantile(frameLum, 0.9),
        },
      });
    }

    // How many bubbles the opening camera can see, over a stretch of simulated
    // time. "A gentle trickle rises somewhere in frame" is a claim about every
    // moment, not about the one the shutter caught.
    game.capture(poses[0].pose);
    const camera = game.camera;
    const probe = new (Object.getPrototypeOf(camera.position).constructor)();
    const matrix = game.bubbles?.mesh.instanceMatrix.array ?? [];
    const seen = [];
    for (let s = 0; s < (game.bubbles ? 200 : 0); s++) {
      game.bubbles.update(1 / 10, false, camera.quaternion);
      let visible = 0;
      for (let i = 0; i < game.bubbles.mesh.count; i++) {
        const o = i * 16;
        probe.set(matrix[o + 12], matrix[o + 13], matrix[o + 14]);
        if (probe.distanceTo(camera.position) > 30) {
          continue;
        }
        probe.project(camera);
        if (probe.z < 1 && Math.abs(probe.x) < 1 && Math.abs(probe.y) < 1) {
          visible++;
        }
      }
      seen.push(visible);
    }

    // The twinkle read off the mote colours rather than hunted for in pixels:
    // it is a slow swell on 220 specks, and a still frame can only show one
    // instant of it.
    const swing = [];
    for (let s = 0; s < 120; s++) {
      game.particles.update(1 / 10, false);
      const shade = game.particles.points.geometry.getAttribute("color").array;
      let low = 1;
      let high = 0;
      for (let i = 0; i < shade.length; i += 3) {
        low = Math.min(low, shade[i]);
        high = Math.max(high, shade[i]);
      }
      swing.push({ low, high, first: shade[0] });
    }

    return {
      results,
      bubbles: {
        seconds: 20,
        mean: seen.reduce((a, b) => a + b, 0) / seen.length,
        min: seen.length ? Math.min(...seen) : 0,
        max: seen.length ? Math.max(...seen) : 0,
        emptyPercent: (seen.filter((v) => v === 0).length / seen.length) * 100,
      },
      twinkle: {
        spread: Math.max(...swing.map((s) => s.high)) - Math.min(...swing.map((s) => s.low)),
        oneMote: {
          min: Math.min(...swing.map((s) => s.first)),
          max: Math.max(...swing.map((s) => s.first)),
        },
      },
    };
  },
  { poses: POSES, threshold: MASK_THRESHOLD },
);

for (const result of measure.results) {
  console.info(
    `${result.name} [${tag}] — frame p10 ${result.frame.p10.toFixed(0)} ` +
      `p50 ${result.frame.p50.toFixed(0)} p90 ${result.frame.p90.toFixed(0)}`,
  );
  for (const layer of result.layers) {
    console.info(
      `  ${layer.name.padEnd(9)} covers ${layer.coverage.toFixed(1).padStart(5)}% of frame | ` +
        `delta p50 ${layer.p50.toFixed(1).padStart(5)} p90 ${layer.p90.toFixed(1).padStart(5)} ` +
        `p99 ${layer.p99.toFixed(1).padStart(5)} max ${layer.max.toFixed(0).padStart(4)} | ` +
        `R-B ${layer.warmth.toFixed(1).padStart(5)}`,
    );
  }
}

const b = measure.bubbles;
if (b.max > 0) {
  console.info(
    `bubbles in the opening frame over ${b.seconds}s: ${b.mean.toFixed(1)} on average ` +
      `(${b.min}..${b.max}), none in ${b.emptyPercent.toFixed(0)}% of frames`,
  );
}
const t = measure.twinkle;
console.info(
  `mote twinkle: field spans ${t.spread.toFixed(2)} of full brightness, ` +
    `one mote swings ${t.oneMote.min.toFixed(2)}..${t.oneMote.max.toFixed(2)} over 12s`,
);

// Shot A through time, for the two layers that only exist while it runs.
for (const settle of MOMENTS) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.evaluate((pose) => window.__reef.capture(pose), { ...POSES[0].pose, settle });
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `tmp_L-opening-t${settle}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

// And the sand's own camera, which is where a dapple is judged. Reloaded
// first, like every pose above: a dev server that re-optimizes its dependencies
// reloads the page under the capture, and what that screenshots is a blank
// canvas over the page background.
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);
await page.evaluate((pose) => window.__reef.capture(pose), POSES[2].pose);
await page.waitForTimeout(250);
const sandFile = path.join(OUT_DIR, `tmp_L-sand_${tag}.png`);
await page.screenshot({ path: sandFile });
console.info(`captured ${path.relative(process.cwd(), sandFile)}`);

await browser.close();
