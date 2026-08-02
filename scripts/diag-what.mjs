/**
 * Edges-fix diagnostics: at a pose, list every visible scene subtree with
 * its mesh names, then raycast through given screen points and report what
 * the ray hits (name, distance) — the "what IS that pixel" tool.
 *
 *   SHOT_URL=http://localhost:5215 node scripts/diag-what.mjs \
 *     --pose x,y,z,yaw,pitch [--force slot] --at ndcX,ndcY --at ...
 */
import { chromium } from "@playwright/test";
import { waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5215";
const args = process.argv.slice(2);
function readAll(flag) {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) values.push(args[i + 1]);
  }
  return values;
}
const poseArg = readAll("--pose")[0];
const force = readAll("--force")[0];
const ats = readAll("--at").map((s) => s.split(",").map(Number));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(180_000);
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await waitForAssets(page);
if (force) {
  for (const slot of force.split(",").map((s) => s.trim()).filter(Boolean)) {
    await page.evaluate((s) => window.__reef.forceRegion(s), slot);
    await waitForAssets(page);
  }
}
const [x, y, z, yaw, pitch] = poseArg.split(",").map(Number);
const pose = { position: [x, y, z], yaw, pitch };
await page.evaluate((p) => window.__reef.capture({ ...p, settle: 3 }), pose);
await waitForAssets(page);
await page.evaluate((p) => window.__reef.capture({ ...p, settle: 0.5 }), pose);
await page.waitForTimeout(600);

const report = await page.evaluate(async (points) => {
  const three = await import("/node_modules/three/build/three.module.js");
  const scene = window.__reef.scene;
  const camera = window.__reef.camera;
  const names = [];
  scene.traverse((o) => {
    if (o.visible && (o.isMesh || o.isPoints) && o.name) {
      names.push(o.name);
    }
  });
  const ray = new three.Raycaster();
  ray.far = 10000;
  const hits = points.map(([nx, ny]) => {
    ray.setFromCamera(new three.Vector2(nx, ny), camera);
    const found = ray
      .intersectObjects(scene.children, true)
      .filter((h) => h.object.visible)
      .slice(0, 6)
      .map((h) => `${h.object.name || h.object.type} @ ${h.distance.toFixed(1)}m`);
    return { at: [nx, ny], found };
  });
  return { fog: scene.fog ? { type: scene.fog.constructor.name, color: `#${scene.fog.color.getHexString()}`, density: scene.fog.density } : null, background: String(scene.background?.constructor?.name ?? scene.background), names: [...new Set(names)].sort(), hits };
}, ats);

console.info(`fog: ${JSON.stringify(report.fog)}`);
console.info(`background: ${report.background}`);
for (const h of report.hits) {
  console.info(`ray ${h.at.join(",")}:`);
  for (const f of h.found) console.info(`   ${f}`);
}
console.info(`visible named meshes (${report.names.length}):`);
console.info(report.names.join("\n"));
await browser.close();
