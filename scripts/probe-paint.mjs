/**
 * Painted-finish probe: what the paper, the pooling and the contour are worth,
 * and what each of them costs.
 *
 *   node scripts/probe-paint.mjs <tag>
 *
 * All three of WP-G5's marks are things a screenshot argues about badly. The
 * grain is a swing of one and a half percent, which is under two parts in 255
 * on lit sand — right where a JPEG-brained eye stops being able to tell "too
 * faint" from "not drawing at all", which is the same trap `probe-light.mjs`
 * was written for. The pooling only exists along wash boundaries, so it is
 * invisible in any whole-frame average and it is exactly the effect a stray
 * threshold turns into a dirty outline around everything. And the contour is
 * the one mark here that is *supposed* to be seen — so what has to be measured
 * about it is that it stays on the animals and off the reef.
 *
 * Each is isolated the same way: the pose is rendered twice, once with that
 * layer neutralised, and the difference is an exact per-pixel mask. None of
 * them needs a switch in the game to do it, which is deliberate — the two grade
 * effects are removed by *patching the grade's own fragment shader* and letting
 * three compile the variant, and the hulls are `visible = false` like any other
 * layer.
 *
 * Patching the source rather than neutralising a uniform is the difference
 * between a measurement and a fiction. Zeroing the texel step the pooling taps
 * are spaced by does silence the effect — and leaves all four texture fetches
 * exactly where they were, which is the entire cost. The first version of this
 * probe did that and reported the pooling as free. Every patch below is
 * checked against the source it is replacing and throws if it did not match,
 * because a replacement that quietly finds nothing reports a layer as free too.
 *
 * The cost half does not sample rAF deltas. Those quantise to whole vsyncs, so
 * a three-millisecond regression and a sixteen-millisecond one report the same
 * number; this times `renderFrame()` directly with a one-pixel `readPixels`
 * after it as a barrier, at a pinned resolution, which is the methodology
 * AGENTS.md asks for and the only one fine enough to attribute a pass.
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 120_000;

const POSES = [
  { name: "A-opening-hero", pose: { position: [0, 2, 22], yaw: 0, pitch: 0, settle: 2 } },
  { name: "C-close-moray", pose: { position: [0, 2, 8], yaw: 0, pitch: -0.09, settle: 1 } },
];

/**
 * Rounds in the cost half. Every round times every configuration once, in the
 * same order, and the medians are taken across rounds — because the thing that
 * ruins this measurement is not per-frame jitter but drift: this frame costs a
 * third of a second on a software rasteriser, so a machine that gets slightly
 * busier over ten seconds will hand the last configuration measured a
 * regression that belongs to the clock. Interleaving spreads that over all of
 * them equally. The first round is discarded.
 */
const TIMED_ROUNDS = 9;

/** A channel has to move this far between the two renders to count as the layer's. */
const MASK_THRESHOLD = 1;

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-paint.mjs <tag>");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const measure = await page.evaluate(
  async ({ poses, threshold, timedRounds }) => {
    const game = window.__reef;
    const gl = game.renderer.renderer.getContext();
    const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const quantile = (sorted, q) =>
      sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

    const grab = () => {
      game.renderFrame();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { width, height, pixels };
    };

    // One pixel is the barrier: `gl.finish` returns as soon as the commands are
    // queued, and a read forces the frame to have actually happened.
    const barrier = new Uint8Array(4);
    const timeOneFrame = () => {
      const start = performance.now();
      game.renderFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, barrier);
      return performance.now() - start;
    };

    const hulls = [];
    for (const scene of [game.scene, game.sanctuary.scene]) {
      scene.traverse((object) => {
        if (object.name === "moray-outline") {
          hulls.push(object);
        }
      });
    }

    // The grade's program, and the two edits that take a layer out of it. Both
    // replacements are exact quotes of the shipped source; three keys its
    // program cache on the shader text, so each variant compiles once on its
    // first frame and is reused from then on.
    const grade = game.renderer.gradePass.material;
    const original = grade.fragmentShader;
    const patch = (source, from, to) => {
      const patched = source.replace(from, to);
      if (patched === source) {
        throw new Error(`probe-paint: nothing matched ${from}`);
      }
      return patched;
    };
    const withoutGrain = patch(
      original,
      "float grain = texture2D(tGrain, vUv * uGrainRepeat).r;",
      "float grain = 0.5;",
    );
    // Both halves of the pooling: the four taps that cost, and the term that
    // shows. The taps go first, because a compiler that eliminates them for
    // itself would hide the cost this is here to find.
    const withoutPooling = patch(
      patch(original, /float edge =\s*\n[^;]*;/, "float edge = 0.0;"),
      "float pooling = smoothstep(EDGE_LOW, EDGE_HIGH, edge);",
      "float pooling = 0.0;",
    );
    // Both grade patches at once: with the hulls hidden as well, this is the
    // frame as it was before the package, reachable without checking anything
    // out — which is the only way to compare the two in the *same* browser, on
    // the same machine, a second apart. This frame costs a third of a second
    // here, and the machine's own drift over the minutes a rebuild takes is
    // larger than everything being measured.
    const withoutAny = patch(
      withoutPooling,
      "float grain = texture2D(tGrain, vUv * uGrainRepeat).r;",
      "float grain = 0.5;",
    );
    const useShader = (source) => {
      grade.fragmentShader = source;
      grade.needsUpdate = true;
    };

    const layers = [
      {
        name: "grain",
        off: () => useShader(withoutGrain),
        on: () => useShader(original),
      },
      {
        name: "pooling",
        off: () => useShader(withoutPooling),
        on: () => useShader(original),
      },
      {
        name: "contour",
        off: () => hulls.forEach((hull) => (hull.visible = false)),
        on: () => hulls.forEach((hull) => (hull.visible = true)),
      },
      {
        name: "the lot",
        off: () => {
          useShader(withoutAny);
          hulls.forEach((hull) => (hull.visible = false));
        },
        on: () => {
          useShader(original);
          hulls.forEach((hull) => (hull.visible = true));
        },
      },
    ];

    const results = [];
    for (const entry of poses) {
      game.capture(entry.pose);
      const full = grab();
      const total = full.width * full.height;

      const layerStats = [];
      for (const layer of layers) {
        layer.off();
        const without = grab();
        layer.on();

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
          warmth += dr - db;
        }
        const sorted = deltas.slice().sort((a, b) => a - b);
        layerStats.push({
          name: layer.name,
          coverage: (deltas.length / total) * 100,
          p10: quantile(sorted, 0.1),
          p50: quantile(sorted, 0.5),
          p90: quantile(sorted, 0.9),
          min: sorted[0] ?? 0,
          max: sorted[sorted.length - 1] ?? 0,
          warmth: deltas.length > 0 ? warmth / deltas.length : 0,
        });
      }

      // Cost, in the same visit and at the same pinned resolution: the whole
      // frame, then the whole frame minus one layer at a time, round-robin.
      const samples = new Map([["all on", []]]);
      for (const layer of layers) {
        samples.set(`no ${layer.name}`, []);
      }
      for (let round = 0; round < timedRounds; round++) {
        samples.get("all on").push(timeOneFrame());
        for (const layer of layers) {
          layer.off();
          samples.get(`no ${layer.name}`).push(timeOneFrame());
          layer.on();
        }
      }
      const costs = [...samples].map(([name, taken]) => ({
        name,
        ms: quantile(taken.slice(1).sort((a, b) => a - b), 0.5),
      }));

      results.push({ name: entry.name, layers: layerStats, costs });
    }

    return results;
  },
  { poses: POSES, threshold: MASK_THRESHOLD, timedRounds: TIMED_ROUNDS },
);

for (const result of measure) {
  console.info(`${result.name} [${tag}]`);
  for (const layer of result.layers) {
    console.info(
      `  ${layer.name.padEnd(8)} covers ${layer.coverage.toFixed(1).padStart(5)}% of frame | ` +
        `delta p10 ${layer.p10.toFixed(1).padStart(6)} p50 ${layer.p50.toFixed(1).padStart(6)} ` +
        `p90 ${layer.p90.toFixed(1).padStart(6)} | range ${layer.min.toFixed(0)}..${layer.max.toFixed(0)} | ` +
        `R-B ${layer.warmth.toFixed(1).padStart(5)}`,
    );
  }
  const full = result.costs[0].ms;
  for (const cost of result.costs) {
    const delta = cost === result.costs[0] ? "" : ` (costs ${(full - cost.ms).toFixed(1)}ms)`;
    console.info(`  ${cost.name.padEnd(12)} ${cost.ms.toFixed(1).padStart(6)}ms${delta}`);
  }
}

await browser.close();
