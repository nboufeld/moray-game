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
  const out = [];
  scene.traverse((node) => {
    const geometry = node.geometry;
    if (!geometry) {
      return;
    }
    const color = geometry.attributes?.color;
    if (color && color.itemSize !== 3) {
      out.push({ name: node.name || node.type, itemSize: color.itemSize });
    }
  });
  return out;
});
console.log("vec4-colour geometries:", JSON.stringify(report));
await browser.close();
