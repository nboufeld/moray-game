import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.setDefaultNavigationTimeout(600000);
page.setDefaultTimeout(600000);
await page.goto("http://localhost:5208/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
const keys = await page.evaluate(() => Object.keys(window.__reef));
console.log("reef keys:", JSON.stringify(keys));
await page.evaluate(() => window.__reef.forceRegion("pale-passage-2"));
await page.waitForTimeout(1200);
const spec = await page.evaluate(() => {
  const reg = window.__reefRegions.defs.find((d) => d.slotId === "pale-passage-2");
  const pose = reg.capturePoses.find((p) => p.name === "the-lamp");
  return { position: [...pose.position], yaw: pose.yaw, pitch: pose.pitch };
});
for (const [label, dyaw] of [["aimed", 0], ["turned", 0.7]]) {
  await page.evaluate(async (p) => {
    window.__reef.capture({ position: p.position, yaw: p.yaw, pitch: p.pitch, settle: 2 });
    await new Promise((r) => setTimeout(r, 2500));
  }, { ...spec, yaw: spec.yaw + dyaw });
  await page.screenshot({ path: `/tmp/pale2-aim-${label}.png` });
  console.log("captured", label);
}
await browser.close();
