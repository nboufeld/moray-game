import { chromium } from "@playwright/test";

// MODE: "count0" | "plain" | "hide" | "none"
const MODE = process.argv[2] ?? "none";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => {
  const text = m.text();
  if (/shader|program|glsl/i.test(text)) {
    console.log("console:", text.slice(0, 400));
  }
});
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("great-blue-1"));

const capture = () =>
  page.evaluate(() => {
    const def = window.__reefRegions.defs.find((d) => d.slotId === "great-blue-1");
    const pose = def.capturePoses.find((p) => p.name === "steppe-sea");
    return window.__reef.capture({
      position: [...pose.position],
      yaw: pose.yaw,
      pitch: pose.pitch,
      settle: 2,
    });
  });

await capture();
await page.waitForTimeout(200);

const applied = await page.evaluate((mode) => {
  const done = [];
  let far = null;
  window.__reef.scene.traverse((node) => {
    if (node.name === "blue1-steppe-far") {
      far = node;
    }
  });
  window.__reef.scene.traverse((node) => {
    if (node.name === "blue1-steppe-near") {
      if (mode === "count0") {
        node.count = 0;
      } else if (mode === "plain") {
        node.material.onBeforeCompile = () => {};
        node.material.customProgramCacheKey = () => "tmp-plain";
        node.material.needsUpdate = true;
      } else if (mode === "hide") {
        node.visible = false;
      } else if (mode === "geoswap" && far) {
        node.geometry = far.geometry;
      } else if (mode === "matswap" && far) {
        node.material = far.material;
      } else if (mode === "cloneonly") {
        node.geometry = node.geometry.clone();
      } else if (mode === "nonindexed") {
        node.geometry = node.geometry.toNonIndexed();
      } else if (mode === "renormal") {
        node.geometry.computeVertexNormals();
        node.geometry.attributes.normal.needsUpdate = true;
      } else if (mode === "posdump") {
        const p = node.geometry.attributes.position;
        const n = node.geometry.attributes.normal;
        const rows = [];
        for (let i = 0; i < p.count; i++) {
          rows.push(
            `${i}: p(${p.getX(i).toFixed(3)}, ${p.getY(i).toFixed(3)}, ${p.getZ(i).toFixed(3)}) n(${n.getX(i).toFixed(2)}, ${n.getY(i).toFixed(2)}, ${n.getZ(i).toFixed(2)})`,
          );
        }
        done.push(
          "POSDUMP count=" + p.count + " itemSize=" + p.itemSize,
          ...rows,
          "index count=" + (node.geometry.index ? node.geometry.index.count : "none"),
        );
      } else if (mode === "rawplane") {
        const three = far.geometry.constructor;
        void three;
        // Rebuild a plain 0.3 x 2.15 plane from the far geometry's class
        // registry: clone the near geometry and overwrite positions with
        // an untouched grid instead.
        const g = node.geometry.clone();
        const p = g.attributes.position;
        // 3 columns x 5 rows grid of the same plane, y in [0, 2.15].
        let i = 0;
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 3; col++) {
            p.setXYZ(i++, (col - 1) * 0.15, (4 - row) * (2.15 / 4), 0);
          }
        }
        p.needsUpdate = true;
        g.computeVertexNormals();
        g.computeBoundingSphere();
        node.geometry = g;
      }
      done.push(node.name);
    }
  });
  return done;
}, MODE);
console.log("applied", MODE, "to", applied);

await capture();
await page.waitForTimeout(200);

// Raycast from the camera through a handful of upper-frame pixels where
// the spikes render, against the near-grass mesh (CPU truth).
const rays = await page.evaluate(() => {
  const game = window.__reef;
  const camera = game.camera ?? game._camera;
  if (!camera) {
    return { error: "no camera", keys: Object.keys(game).slice(0, 40) };
  }
  let near = null;
  game.scene.traverse((node) => {
    if (node.name === "blue1-steppe-near") {
      near = node;
    }
  });
  if (!near) {
    return { error: "no near mesh" };
  }
  const THREE_Raycaster = near.constructor.name; // placeholder
  void THREE_Raycaster;
  const hits = [];
  // Use the game's own three via the mesh's raycast method.
  const RaycasterCtor = Object.getPrototypeOf(game.scene).constructor; // Scene
  void RaycasterCtor;
  // Build a raycaster without importing three: steal from camera's clone.
  // Simplest: use camera projection math by hand is overkill — the page
  // bundles three, and meshes expose .raycast(raycaster, hits) — so we
  // need a Raycaster instance. Grab it off the game if exposed.
  const ray = game.raycaster ?? null;
  if (!ray) {
    return { error: "no raycaster handle", note: "skip" };
  }
  for (const [nx, ny] of [[-0.5, 0.7], [0.0, 0.8], [0.4, 0.6], [-0.2, 0.9]]) {
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const found = ray.intersectObject(near, false);
    hits.push({ nx, ny, hit: found.length, d: found[0] ? +found[0].distance.toFixed(1) : null, inst: found[0]?.instanceId ?? null });
  }
  return { hits };
});
console.log("rays:", JSON.stringify(rays));
await page.screenshot({ path: `visual-qa/tmp-mode-${MODE}.png` });
await browser.close();
