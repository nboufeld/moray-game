import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("great-blue-1"));
await page.evaluate((p) => {
  const def = window.__reefRegions.defs.find((d) => d.slotId === "great-blue-1");
  const pose = def.capturePoses[2];
  return window.__reef.capture({
    position: [...pose.position],
    yaw: pose.yaw,
    pitch: pose.pitch,
    settle: 0.5,
  });
});
await page.waitForTimeout(200);

const report = await page.evaluate(() => {
  const scene = window.__reef.scene;
  const out = {};
  scene.traverse((node) => {
    if (node.name === "blue1-steppe-near" || node.name === "blue1-steppe-far") {
      const g = node.geometry;
      g.computeBoundingBox();
      const bb = g.boundingBox;
      const matrices = [];
      const m = new Array(16);
      for (const i of [0, 1, 2, Math.max(0, node.count - 1)]) {
        for (let k = 0; k < 16; k++) {
          m[k] = +node.instanceMatrix.array[i * 16 + k].toFixed(3);
        }
        matrices.push([...m]);
      }
      out[node.name] = {
        count: node.count,
        geomBox: {
          min: [bb.min.x, bb.min.y, bb.min.z].map((n) => +n.toFixed(2)),
          max: [bb.max.x, bb.max.y, bb.max.z].map((n) => +n.toFixed(2)),
        },
        matrices,
      };
    }
  });
  return out;
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
