import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => {
  const text = m.text();
  if (/error|warn|shader|glsl/i.test(text)) {
    console.log("console:", text.slice(0, 1500));
  }
});
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("great-blue-1"));

await page.evaluate(() => {
  const scene = window.__reef.scene;
  scene.traverse((node) => {
    if (node.name === "blue1-steppe-near" || node.name === "blue1-steppe-far") {
      node.material.onBeforeCompile = () => {};
      node.material.customProgramCacheKey = () => node.name + "-plain";
      node.material.needsUpdate = true;
    }
  });
});

await page.evaluate(() => {
  const def = window.__reefRegions.defs.find((d) => d.slotId === "great-blue-1");
  const pose = def.capturePoses[2];
  return window.__reef.capture({
    position: [...pose.position],
    yaw: pose.yaw,
    pitch: pose.pitch,
    settle: 1,
  });
});
await page.waitForTimeout(300);
await page.screenshot({ path: "visual-qa/tmp-debug-plain-shader.png" });
await browser.close();
