/**
 * Measures the coral garden the way `probe-fish.mjs` measures the school.
 *
 *   node scripts/probe-coral.mjs <tag>
 *
 * It exists because a screenshot cannot answer either of the two questions
 * this package is judged on.
 *
 * **"Is the landmark in the frame?"** A garden with hierarchy is a garden whose
 * biggest pieces can be *seen*, and a thicket a metre and a half tall that
 * happens to stand nine metres to the left of shot B is worth exactly nothing.
 * That failure looks identical to "the landmarks are too small" and is not it.
 * So this counts what falls inside each canonical frustum, per species, and
 * reports how many degrees of frame the biggest one covers — which is the
 * number "reads from fifteen metres" actually means.
 *
 * **"What is it costing?"** Draw calls and triangles are read off the live
 * scene rather than off the source, because the two disagree: the modelled
 * species arrive from disk after construction and roughly double their bucket's
 * triangle count when they land. It also times a frame with the garden hidden
 * and again with it shown, the same isolation `probe-light.mjs` uses, with a
 * one-pixel read after each render as a barrier — `gl.finish` returns as soon
 * as the commands are queued, and rAF deltas can only resolve multiples of
 * 16.66 ms.
 *
 * Requires a dev server on http://localhost:5173 (override with SHOT_URL).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = 120_000;

/** Every bucket the field builds; see `CoralShapes.CoralKind`. */
const KINDS = ["staghorn", "brain", "plateStack", "tube", "fan", "branch", "boulder", "polyp"];

/**
 * The canonical poses the garden is composed for, plus the tidepool.
 *
 * Copied from `capture-shots.mjs` rather than imported, because what this
 * measures is the *frustum* and not the picture: it never calls `capture()`, so
 * it never stops the loop, and it can therefore report on a world that is still
 * running.
 */
const POSES = {
  "A-opening-hero": { position: [0, 2, 22], yaw: 0, pitch: 0 },
  "B-mid-depth-traverse": { position: [10, 3, 12], yaw: 0.72, pitch: -0.1 },
  "C-close-moray-detection": { position: [0, 2, 8], yaw: 0, pitch: -0.09 },
  "G-tidepool-close": { position: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25 },
};

/**
 * Standing views of three gardens, the way `probe-moray.mjs` walks up to each
 * crevice.
 *
 * The canonical set looks at this reef from ten to twenty metres out, where a
 * coral is a few dozen pixels and every species reads as "some coral". These
 * stand at conversational distance instead, one per composition the garden is
 * built for: the shot-A mass, the eastern bommie shot B crosses, and the
 * tidepool drift shot G is knee-deep in.
 */
const VIEWS = {
  /**
   * Three and a half metres from the tallest thicket in the reef, which is the
   * only distance at which a landmark can be judged as a *shape* rather than as
   * a coloured mass. Everything else here is about whether the garden reads;
   * this one is about whether the piece is any good.
   */
  "landmark-staghorn": { position: [-5.2, 1.5, 14.3], yaw: 0, pitch: -0.14, settle: 2 },
  "cluster-rose": { position: [-5.4, 1.9, 17.4], yaw: 0.06, pitch: -0.12, settle: 2 },
  "cluster-ochre": { position: [8.6, 1.9, 2.4], yaw: 0.32, pitch: -0.14, settle: 2 },
  "cluster-tidepool": { position: [4.2, 1.4, 13.6], yaw: 0.02, pitch: -0.16, settle: 2 },
};

/** Default vertical field of view; `AccessibilitySettings.fieldOfView`. */
const FOV = 70;
/** Past this the fog has closed and a coral is a smudge of the water's colour. */
const FOG_REACH = 45;

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/probe-coral.mjs <tag>");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
page.setDefaultTimeout(NAV_TIMEOUT_MS);
page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "warning" || message.type() === "error") {
    console.info(`  page: ${message.text()}`);
  }
});

if (noAssets) {
  console.info("SHOT_NO_ASSETS=1 — probing the procedural fallback build");
  await blockAssets(page);
}

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);

const buckets = await page.evaluate((kinds) => {
  const out = [];
  window.__reef.scene.traverse((node) => {
    if (!node.isInstancedMesh || !kinds.includes(node.name)) {
      return;
    }
    const geometry = node.geometry;
    const matrices = node.instanceMatrix.array;
    const instances = [];
    for (let i = 0; i < node.count; i++) {
      const at = i * 16;
      instances.push([
        matrices[at + 12],
        matrices[at + 13],
        matrices[at + 14],
        // The y column's length is the piece's height in metres, because
        // everything modelled here is authored one unit tall.
        Math.hypot(matrices[at + 4], matrices[at + 5], matrices[at + 6]),
      ]);
    }
    out.push({
      name: node.name,
      count: node.count,
      tris: (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3,
      color: Boolean(geometry.attributes.color),
      uv: Boolean(geometry.attributes.uv),
      alphaTest: node.material.alphaTest,
      glowing: node.material.emissive ? node.material.emissive.getHex() !== 0 : false,
      instances,
    });
  });
  return out;
}, KINDS);

console.info(`coral garden — ${tag}`);
console.info("buckets (one draw call each)");
let triangles = 0;
for (const bucket of buckets) {
  triangles += bucket.tris * bucket.count;
  console.info(
    `  ${bucket.name.padEnd(11)}${bucket.glowing ? "*" : " "} n=${String(bucket.count).padStart(4)}` +
      `  tris/inst ${String(bucket.tris).padStart(5)}` +
      `  vcol ${bucket.color ? "y" : "n"}  uv ${bucket.uv ? "y" : "n"}` +
      `  alphaTest ${bucket.alphaTest || "-"}`,
  );
}
console.info(
  `  ${buckets.length} draw calls, ` +
    `${buckets.reduce((sum, b) => sum + b.count, 0)} instances, ` +
    `${triangles.toLocaleString()} triangles   (* glowing)`,
);

const tanY = Math.tan((FOV * Math.PI) / 360);
const tanX = tanY * (VIEWPORT.width / VIEWPORT.height);

for (const [name, pose] of Object.entries(POSES)) {
  const [cx, cy, cz] = pose.position;
  const cosPitch = Math.cos(pose.pitch);
  const forward = [-Math.sin(pose.yaw) * cosPitch, Math.sin(pose.pitch), -Math.cos(pose.yaw) * cosPitch];
  const right = [Math.cos(pose.yaw), 0, -Math.sin(pose.yaw)];
  const up = [
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0],
  ];

  const seen = {};
  for (const bucket of buckets) {
    for (const [x, y, z, height] of bucket.instances) {
      const to = [x - cx, y - cy, z - cz];
      const depth = to[0] * forward[0] + to[1] * forward[1] + to[2] * forward[2];
      if (depth < 0.3 || depth > FOG_REACH) {
        continue;
      }
      const across = to[0] * right[0] + to[1] * right[1] + to[2] * right[2];
      const above = to[0] * up[0] + to[1] * up[1] + to[2] * up[2];
      if (Math.abs(across) > tanX * depth || Math.abs(above) > tanY * depth) {
        continue;
      }
      const entry = (seen[bucket.name] ??= { n: 0, nearest: Infinity, tallest: 0, degrees: 0 });
      entry.n++;
      entry.nearest = Math.min(entry.nearest, depth);
      entry.tallest = Math.max(entry.tallest, height);
      entry.degrees = Math.max(entry.degrees, (Math.atan2(height, depth) * 180) / Math.PI);
    }
  }

  console.info(`${name}`);
  let total = 0;
  for (const kind of KINDS) {
    const entry = seen[kind];
    if (!entry) {
      console.info(`  ${kind.padEnd(11)} —`);
      continue;
    }
    total += entry.n;
    console.info(
      `  ${kind.padEnd(11)} ${String(entry.n).padStart(3)} in frame  nearest ${entry.nearest.toFixed(1)}m` +
        `  tallest ${entry.tallest.toFixed(2)}m  biggest ${entry.degrees.toFixed(1)}° of frame`,
    );
  }
  console.info(`  ${total} pieces in frame`);
}

/**
 * Frame cost, with the garden and without it.
 *
 * The whole group is hidden rather than the instances being emptied, so the
 * difference is exactly what the coral draws — including the fans' discarded
 * fragments, which is the number this package's budget is really about.
 *
 * It is measured twice, at two resolutions, because the round's frame budget is
 * quoted against `measure-frames.mjs` and that harness measures a *different
 * picture*: 1280×720 with the adaptive scaler left free, which on a software
 * rasteriser settles at its 0.34 floor — about a thirteenth of the pixels this
 * probe pins for its screenshots. A garden that is mostly fill (and forty-eight
 * alpha-tested fans are mostly fill) shrinks with that, and a garden that is
 * mostly draw calls does not, so quoting only the big number would overstate
 * the cost by an order of magnitude and quoting only the small one would hide
 * where it goes.
 */
async function measure(page, kinds, scale) {
  return page.evaluate(async ([kindList, renderScale]) => {
  const game = window.__reef;
  const renderer = game.renderer;
  renderer.pinRenderScale(renderScale);
  const meshes = [];
  game.scene.traverse((node) => {
    if (node.isInstancedMesh && kindList.includes(node.name)) {
      meshes.push(node);
    }
  });

  const gl = renderer.renderer.getContext();
  const pixel = new Uint8Array(4);
  const once = (visible, shadows = true) => {
    for (const mesh of meshes) {
      mesh.visible = visible;
      mesh.castShadow = shadows && mesh.userData.castShadow !== false;
    }
    const start = performance.now();
    renderer.render(game.scene, game.camera);
    // A barrier: `gl.finish` returns once the commands are queued, a
    // `readPixels` does not return until they have run.
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return performance.now() - start;
  };

  /**
   * Interleaved, not blocked, and this is the whole reason the number means
   * anything on a shared machine. A run of nine frames with the coral and then
   * nine without takes half a minute here, and the load average moves more
   * than the garden costs inside that window — measured back to back the
   * garden came out at *minus* two hundred milliseconds, which is the other
   * agent's build finishing rather than a coral that pays for itself.
   * Alternating puts the same drift through both arms.
   */
  for (const mesh of meshes) {
    mesh.userData.castShadow = mesh.castShadow;
  }
  once(true);
  once(false);
  const shown = [];
  const hidden = [];
  const unshadowed = [];
  for (let i = 0; i < 11; i++) {
    shown.push(once(true));
    hidden.push(once(false));
    unshadowed.push(once(true, false));
  }
  for (const mesh of meshes) {
    mesh.visible = true;
    mesh.castShadow = mesh.userData.castShadow;
  }
  const median = (runs) => runs.sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  // Per-pair as well as per-arm: a pair straddles a fraction of a second, so
  // its difference is the one number a load spike cannot fake.
  return {
    withCoral: median(shown),
    without: median(hidden),
    paired: median(shown.map((value, i) => value - hidden[i])),
    // What the coral costs the shadow pass, which submits every triangle a
    // second time. The reef's grass and fish opted out of it years ago.
    shadow: median(shown.map((value, i) => value - unshadowed[i])),
  };
  }, [kinds, scale]);
}

console.info("frame cost at the opening pose (11 interleaved pairs)");
const pinned = await measure(page, KINDS, 1);
console.info(
  `  ${VIEWPORT.width}x${VIEWPORT.height} at scale 1.00:` +
    ` frame ${pinned.withCoral.toFixed(1)}ms, garden ${pinned.paired.toFixed(1)}ms` +
    `, of which shadow pass ${pinned.shadow.toFixed(1)}ms`,
);

// The conditions `measure-frames.mjs` reports the round's budget in.
await page.setViewportSize({ width: 1280, height: 720 });
const settled = await measure(page, KINDS, 0.34);
console.info(
  `  1280x720 at scale 0.34:` +
    ` frame ${settled.withCoral.toFixed(1)}ms, garden ${settled.paired.toFixed(1)}ms` +
    `, of which shadow pass ${settled.shadow.toFixed(1)}ms`,
);

/**
 * Where the garden's milliseconds actually go, one bucket at a time.
 *
 * Hiding a single bucket and diffing is the only way to tell a species that is
 * expensive because there are three hundred of it from one that is expensive
 * because each one is three thousand triangles — and the two want opposite
 * fixes. Measured at the settled scale, because that is where the budget is
 * quoted, and interleaved against the full frame for the same reason the pass
 * above is.
 */
const perBucket = await page.evaluate(
  async ([kindList, renderScale]) => {
    const game = window.__reef;
    const renderer = game.renderer;
    renderer.pinRenderScale(renderScale);
    const meshes = [];
    game.scene.traverse((node) => {
      if (node.isInstancedMesh && kindList.includes(node.name)) {
        meshes.push(node);
      }
    });

    const gl = renderer.renderer.getContext();
    const pixel = new Uint8Array(4);
    const once = () => {
      const start = performance.now();
      renderer.render(game.scene, game.camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return performance.now() - start;
    };
    const median = (runs) => runs.sort((a, b) => a - b)[Math.floor(runs.length / 2)];

    once();
    const out = [];
    for (const [index, mesh] of meshes.entries()) {
      const full = [];
      const less = [];
      for (let i = 0; i < 5; i++) {
        mesh.visible = true;
        full.push(once());
        mesh.visible = false;
        less.push(once());
      }
      mesh.visible = true;
      out.push({
        name: mesh.name,
        index,
        count: mesh.count,
        tris: (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3,
        ms: median(full.map((value, i) => value - less[i])),
      });
    }
    return out;
  },
  [KINDS, 0.34],
);

console.info("per bucket at 1280x720 scale 0.34 (median of five interleaved pairs)");
for (const bucket of perBucket.sort((a, b) => b.ms - a.ms)) {
  console.info(
    `  ${bucket.name.padEnd(11)} n=${String(bucket.count).padStart(4)}` +
      `  ${String(bucket.tris * bucket.count).padStart(6)} tris  ${bucket.ms.toFixed(1)}ms`,
  );
}

await page.setViewportSize(VIEWPORT);

const outDir = path.resolve("visual-qa");
await mkdir(outDir, { recursive: true });
for (const [name, pose] of Object.entries(VIEWS)) {
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  await page.evaluate((p) => window.__reef.capture(p), pose);
  await page.waitForTimeout(250);
  const file = path.join(outDir, `tmp_coral-${name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

await browser.close();
