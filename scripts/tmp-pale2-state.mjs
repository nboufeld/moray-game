import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.setDefaultNavigationTimeout(600000);
page.setDefaultTimeout(600000);
await page.goto("http://localhost:5208/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("pale-passage-2"));
await page.waitForTimeout(1200);
const report = await page.evaluate(async () => {
  const g = window.__reef;
  const reg = window.__reefRegions.defs.find((d) => d.slotId === "pale-passage-2");
  const poseA = reg.capturePoses.find((p) => p.name === "the-lamp");
  const poseB = reg.capturePoses.find((p) => p.name === "gallery-crossing");
  const out = {};
  for (const [label, pose] of [["lamp", poseA], ["crossing", poseB]]) {
    g.capture({ position: [...pose.position], yaw: pose.yaw, pitch: pose.pitch, settle: 2 });
    await new Promise((r) => setTimeout(r, 2500));
    out[label] = {
      posePos: pose.position.map((n) => n.toFixed(1)),
      camera: g.camera.position.toArray().map((n) => n.toFixed(1)),
      diver: g.dive?.position ? g.dive.position.toArray().map((n) => n.toFixed(1)) : "n/a",
      fog: g.scene.fog ? { color: g.scene.fog.color.getHexString(), density: g.scene.fog.density } : null,
      toneMappingExposure: g.renderer.toneMappingExposure,
      background: g.scene.background?.getHexString?.() ?? String(g.scene.background),
    };
  }
  return out;
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
