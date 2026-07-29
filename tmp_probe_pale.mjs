// Temporary debug probe — not part of the branch's shipped files.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.error("pageerror:", e.message));
let shaderErrorShown = false;
page.on("console", (m) => {
  if (m.type() === "error" && !shaderErrorShown) {
    shaderErrorShown = true;
    console.log("console error (full):\n", m.text().slice(0, 4000));
  }
});
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
await page.goto("http://localhost:5182/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("pale-passage-1"));

// Mirror the capture harness: pose inside the region so the streamer keeps it.
const pose = await page.evaluate(() => {
  const def = window.__reefRegions.defs.find((d) => d.slotId === "pale-passage-1");
  return def.capturePoses.find((p) => p.name === "seed-grove");
});
await page.evaluate(
  (p) =>
    window.__reef.capture({
      position: [...p.position],
      yaw: p.yaw,
      pitch: p.pitch,
      settle: p.settle,
    }),
  pose,
);
await page.waitForTimeout(500);

const report = await page.evaluate(() => {
  const scene = window.__reef.scene;
  let group = null;
  const found = [];
  const search = (node) => {
    if (node.name && (node.name.startsWith("pale") || node.name.startsWith("region-pale"))) {
      found.push({
        name: node.name,
        type: node.type,
        visible: node.visible,
        count: node.count,
        inFrustumCull: node.frustumCulled,
        sphere: node.geometry?.boundingSphere
          ? {
              c: node.geometry.boundingSphere.center.toArray().map((n) => Math.round(n)),
              r: Math.round(node.geometry.boundingSphere.radius),
            }
          : null,
      });
    }
    if (node.name === "region-pale-passage-1") {
      group = { children: node.children.length };
    }
    for (const child of node.children ?? []) {
      search(child);
    }
  };
  search(scene);
  const camera = window.__reef.camera;
  return {
    camera: camera.position.toArray().map((n) => Math.round(n * 10) / 10),
    group,
    total: found.length,
    found,
  };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
