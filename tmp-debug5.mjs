import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("great-blue-1"));

const report = await page.evaluate(() => {
  const scene = window.__reef.scene;
  const out = {};
  scene.traverse((node) => {
    if (node.name !== "blue1-steppe-near" && node.name !== "blue1-steppe-far") {
      return;
    }
    const a = node.instanceMatrix.array;
    let nan = 0;
    let maxScale = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    const weird = [];
    for (let i = 0; i < node.count; i++) {
      const sx = Math.hypot(a[i * 16], a[i * 16 + 1], a[i * 16 + 2]);
      const sy = Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6]);
      const y = a[i * 16 + 13];
      for (let k = 0; k < 16; k++) {
        if (!Number.isFinite(a[i * 16 + k])) {
          nan++;
          break;
        }
      }
      maxScale = Math.max(maxScale, sx, sy);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (sy > 2 || y > -5 || y < -50) {
        if (weird.length < 5) {
          weird.push({ i, sy: +sy.toFixed(2), y: +y.toFixed(1) });
        }
      }
    }
    out[node.name] = { count: node.count, nan, maxScale: +maxScale.toFixed(2), minY: +minY.toFixed(1), maxY: +maxY.toFixed(1), weird };
  });
  return out;
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
