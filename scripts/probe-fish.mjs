/**
 * Fish-believability probe.
 *
 *   node scripts/probe-fish.mjs <tag>
 *
 * A school is a few hundred small, moving shapes, which is exactly the subject
 * a whole-frame screenshot review is worst at: the shoal is a scatter of pixels
 * and "does it pop" is a judgement about the values of those pixels against the
 * water immediately behind them. This measures that directly rather than by
 * eye — it renders each pose twice, once with the school hidden, and takes the
 * difference as an exact per-pixel mask of the fish. Everything reported is
 * then read through that mask: what the fish are worth, what the water they
 * cover is worth, and the gap between the two, which is the pop.
 *
 * Pixels come from `gl.readPixels` on the default framebuffer immediately after
 * a synchronous re-render, so they are the real composited frame — through
 * bloom, the grade and tone mapping — and not the raw scene-linear pixels an
 * off-screen target would hand back.
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 120_000;

/**
 * The two canonical cameras the review judges the school from, plus one that
 * looks out along the water at nothing else — the cleanest read of a shoal
 * against the backdrop, with no rock or sand in the way to anchor the eye.
 */
const POSES = [
  { name: "B-mid-depth-traverse", pose: { position: [10, 3, 12], yaw: 0.72, pitch: -0.1, settle: 3 } },
  { name: "C-close-moray-detection", pose: { position: [0, 2, 8], yaw: 0, pitch: -0.09, settle: 1 } },
  { name: "W-open-water", pose: { position: [0, 4, 20], yaw: -0.9, pitch: 0.06, settle: 3 } },
];

/**
 * How far a channel has to move between the two renders for a pixel to count as
 * the school's. Above the composited frame's own dither and bloom bleed, well
 * below the difference a fish actually makes.
 */
const MASK_THRESHOLD = 6;

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-fish.mjs <tag>");
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

/**
 * Everything below runs in the page. `__reef` is the `Game`; TypeScript's
 * `private` is a compile-time fiction, so its scene, camera, renderer and fish
 * are all reachable here — which is the whole reason a probe can be written
 * without opening holes in the game's API for it.
 */
const measure = await page.evaluate(
  async ({ poses, threshold }) => {
    const game = window.__reef;
    const adapter = game.renderer;
    const gl = adapter.renderer.getContext();
    const fish = game.fish;
    const camera = game.camera;

    const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

    /** The real composited frame, read back before the compositor clears it. */
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

    const summarise = (values) => {
      const sorted = values.slice().sort((a, b) => a - b);
      return {
        count: sorted.length,
        mean: sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length),
        p50: quantile(sorted, 0.5),
        p90: quantile(sorted, 0.9),
        p99: quantile(sorted, 0.99),
        max: sorted[sorted.length - 1] ?? 0,
      };
    };

    /**
     * Hides every instance nearer than `minRange` by collapsing it to zero
     * scale, so the far shoal can be measured on its own. The matrices are
     * rewritten from scratch on the next `update`, so this is not destructive.
     */
    const keepBeyond = (minRange) => {
      const array = fish.mesh.instanceMatrix.array;
      const eye = game.camera.position;
      for (let i = 0; i < fish.mesh.count; i++) {
        const o = i * 16;
        const dx = array[o + 12] - eye.x;
        const dy = array[o + 13] - eye.y;
        const dz = array[o + 14] - eye.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) >= minRange) {
          continue;
        }
        for (let e = 0; e < 12; e++) {
          array[o + e] = 0;
        }
      }
      fish.mesh.instanceMatrix.needsUpdate = true;
    };

    /**
     * Fish pixels against the frame that does not contain them: the school's
     * own values, the water each of its pixels covers, and — the number the
     * review is actually about — how far above that water each pixel sits.
     */
    const maskStats = (withFish, without, fromRow) => {
      const fishLum = [];
      const waterLum = [];
      const delta = [];
      for (let y = fromRow; y < withFish.height; y++) {
        for (let x = 0; x < withFish.width; x++) {
          const i = (y * withFish.width + x) * 4;
          const dr = Math.abs(withFish.pixels[i] - without.pixels[i]);
          const dg = Math.abs(withFish.pixels[i + 1] - without.pixels[i + 1]);
          const db = Math.abs(withFish.pixels[i + 2] - without.pixels[i + 2]);
          if (dr < threshold && dg < threshold && db < threshold) {
            continue;
          }
          const lf = luminance(withFish.pixels[i], withFish.pixels[i + 1], withFish.pixels[i + 2]);
          const lw = luminance(without.pixels[i], without.pixels[i + 1], without.pixels[i + 2]);
          fishLum.push(lf);
          waterLum.push(lw);
          delta.push(lf - lw);
        }
      }
      return { fish: summarise(fishLum), water: summarise(waterLum), delta: summarise(delta) };
    };

    const results = [];
    for (const entry of poses) {
      game.capture(entry.pose);

      fish.mesh.visible = true;
      const withFish = grab();
      fish.mesh.visible = false;
      const without = grab();

      // Rows run bottom-up out of GL. The school lives in the water column, so
      // the upper half of the frame is where the review is looking; expressed
      // here as the top 45% of the image, i.e. the last 45% of GL rows.
      const upperFrom = Math.floor(withFish.height * 0.55);

      // The same frame again with only the distant half of the school in it.
      // Distance is the whole question here — near fish are supposed to read as
      // silver — and it cannot be recovered from a pixel after the fact.
      fish.mesh.visible = true;
      keepBeyond(entry.farRange ?? 22);
      const farOnly = grab();

      results.push({
        name: entry.name,
        farRange: entry.farRange ?? 22,
        whole: maskStats(withFish, without, 0),
        upper: maskStats(withFish, without, upperFrom),
        far: maskStats(farOnly, without, 0),
      });
    }

    // How far away the school actually is, so the fog factor it receives can be
    // checked against the density rather than guessed at.
    // Element 12/13/14 of each 16-float block is that instance's translation.
    const instances = fish.mesh.instanceMatrix.array;
    const distances = [];
    for (let i = 0; i < fish.mesh.count; i++) {
      const dx = instances[i * 16 + 12] - camera.position.x;
      const dy = instances[i * 16 + 13] - camera.position.y;
      const dz = instances[i * 16 + 14] - camera.position.z;
      distances.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    distances.sort((a, b) => a - b);

    // How many fish the traverse camera can actually see, sampled over a stretch
    // of simulated time. A school that travels is a school that comes and goes,
    // which is the point — but "comes and goes" and "is almost never there" look
    // identical in any four screenshots, and only one of them is acceptable.
    // Counted against the real frustum and the range the fog leaves anything
    // visible at, so it answers the composition question directly.
    game.capture(poses[0].pose);
    const seen = [];
    const probe = new (Object.getPrototypeOf(camera.position).constructor)();
    for (let s = 0; s < 300; s++) {
      fish.update(1 / 20, false, camera.position);
      const array = fish.mesh.instanceMatrix.array;
      let visible = 0;
      for (let i = 0; i < fish.mesh.count; i++) {
        const o = i * 16;
        probe.set(array[o + 12], array[o + 13], array[o + 14]);
        // Roughly where the fish fog leaves anything to see. Counting to the
        // far plane instead reports a frame full of school that is, in fact,
        // a frame full of water.
        if (probe.distanceTo(camera.position) > 24) {
          continue;
        }
        probe.project(camera);
        if (probe.z < 1 && Math.abs(probe.x) < 1 && Math.abs(probe.y) < 1) {
          visible++;
        }
      }
      seen.push(visible);
    }

    // The glint read straight off the instance colours rather than hunted for
    // in pixels: it is a flick lasting under a second on a handful of fish, so
    // a still frame is very likely to contain none at all and prove nothing.
    // Sampled across a stretch of simulated time instead, which answers the
    // question that matters — how often does the school catch the light.
    const glintSamples = [];
    for (let s = 0; s < 240; s++) {
      fish.update(1 / 30, false, game.camera.position);
      const colors = fish.mesh.instanceColor.array;
      let lit = 0;
      let peak = 1;
      for (let i = 0; i < fish.mesh.count; i++) {
        const g = colors[i * 3 + 1];
        if (g > 1.15) {
          lit++;
        }
        peak = Math.max(peak, g);
      }
      glintSamples.push({ lit, peak });
    }

    const material = fish.mesh.material;
    return {
      results,
      onCamera: {
        seconds: 300 / 20,
        mean: seen.reduce((a, b) => a + b, 0) / seen.length,
        min: Math.min(...seen),
        max: Math.max(...seen),
        emptyPercent: (seen.filter((v) => v < 4).length / seen.length) * 100,
      },
      glint: {
        seconds: 240 / 30,
        meanLit: glintSamples.reduce((a, b) => a + b.lit, 0) / glintSamples.length,
        maxLit: Math.max(...glintSamples.map((s) => s.lit)),
        peak: Math.max(...glintSamples.map((s) => s.peak)),
        framesWithNone: glintSamples.filter((s) => s.lit === 0).length,
      },
      distances: {
        min: distances[0],
        p50: distances[Math.floor(distances.length * 0.5)],
        p90: distances[Math.floor(distances.length * 0.9)],
        max: distances[distances.length - 1],
      },
      material: {
        fogEnabled: material.fog,
        sceneFog: game.scene.fog
          ? { type: game.scene.fog.constructor.name, density: game.scene.fog.density }
          : null,
        color: material.color.getHexString(),
        roughness: material.roughness,
        metalness: material.metalness,
        vertexColors: material.vertexColors,
      },
    };
  },
  { poses: POSES, threshold: MASK_THRESHOLD },
);

const m = measure.material;
console.info(`fish material: color #${m.color} rough ${m.roughness} metal ${m.metalness}`);
console.info(
  `  material.fog=${m.fogEnabled} scene.fog=${m.sceneFog ? `${m.sceneFog.type}@${m.sceneFog.density}` : "none"}`,
);
console.info(
  `  distance to school (last pose): min ${measure.distances.min.toFixed(1)}m ` +
    `p50 ${measure.distances.p50.toFixed(1)}m p90 ${measure.distances.p90.toFixed(1)}m ` +
    `max ${measure.distances.max.toFixed(1)}m`,
);

/**
 * The pop is a property of the school's bright tail, not of its average: most
 * of a fish's pixels are its shadow side and its antialiased edge, and those
 * drag a mean down to nothing while the frame still reads as scraps of paper.
 * So every band is reported at p90/p99 as well.
 */
const band = (label, s) =>
  console.info(
    `  ${label.padEnd(11)} fish p50 ${s.fish.p50.toFixed(0).padStart(3)} ` +
      `p90 ${s.fish.p90.toFixed(0).padStart(3)} p99 ${s.fish.p99.toFixed(0).padStart(3)} ` +
      `max ${s.fish.max.toFixed(0).padStart(3)} | water p50 ${s.water.p50.toFixed(0).padStart(3)} | ` +
      `over water p90 ${s.delta.p90.toFixed(0).padStart(4)} p99 ${s.delta.p99.toFixed(0).padStart(4)} ` +
      `| ${s.fish.count} px`,
  );

const v = measure.onCamera;
console.info(
  `  in the traverse frame over ${v.seconds}s: ${v.mean.toFixed(1)} fish on average ` +
    `(${v.min}..${v.max}), fewer than 4 in ${v.emptyPercent.toFixed(0)}% of frames`,
);

const g = measure.glint;
console.info(
  `  glint over ${g.seconds}s: ${g.meanLit.toFixed(1)} of ${170} fish lit on an average frame ` +
    `(max ${g.maxLit}, none in ${((g.framesWithNone / (g.seconds * 30)) * 100).toFixed(0)}% of frames), ` +
    `peak gain ${g.peak.toFixed(2)}x`,
);

for (const r of measure.results) {
  console.info(`${r.name} [${tag}]`);
  band("whole", r.whole);
  band("upper 45%", r.upper);
  band(`>${r.farRange}m`, r.far);
}

// A frame of each pose so the numbers can be looked at as well as read.
for (const entry of POSES) {
  await page.evaluate((pose) => window.__reef.capture(pose), entry.pose);
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `tmp_F-${entry.name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

/**
 * The canonical set holds one frame per camera, and one frame of a school is
 * not evidence about a school: where its shoals happen to be at second three
 * says nothing about where they are at second forty. A shoal drifting across
 * the lens is only a problem if it is a *recurring* problem, and a single shot
 * cannot tell those apart — the same reason `probe-sanctuary` walks its sweep.
 * Shot B is the one the review judges the school from, so it gets the sweep.
 */
const TRAVERSE = POSES[0];
for (const settle of [3, 18, 34, 52]) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await page.evaluate((pose) => window.__reef.capture(pose), { ...TRAVERSE.pose, settle });
  await page.waitForTimeout(250);
  const file = path.join(OUT_DIR, `tmp_F-drift-t${settle}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
