import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.setDefaultNavigationTimeout(600000);
page.setDefaultTimeout(600000);
await page.goto("http://localhost:5208/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("pale-passage-2"));
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const reg = window.__reefRegions.defs.find((d) => d.slotId === "pale-passage-2");
  const pose = reg.capturePoses.find((p) => p.name === "the-lamp");
  window.__reef.capture({ position: [...pose.position], yaw: pose.yaw, pitch: pose.pitch, settle: 2 });
  await new Promise((r) => setTimeout(r, 2500));
});
for (const idx of [0, 38]) {
  await page.evaluate((i) => {
    for (const [j, child] of window.__reef.scene.children.entries()) child.visible = j !== i;
  }, idx);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/pale2-hide-${idx}.png` });
}
// Also: everything visible again, and list what child 0 contains.
const inside = await page.evaluate(() => {
  for (const child of window.__reef.scene.children) child.visible = true;
  const g = window.__reef.scene.children[0];
  return g.children.map((c) => c.name || c.type).slice(0, 60);
});
console.log("child0 contents:", JSON.stringify(inside));
await browser.close();
