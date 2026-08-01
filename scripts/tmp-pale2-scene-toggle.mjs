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
const list = await page.evaluate(() =>
  window.__reef.scene.children.map((c, i) => `${i}:${c.name || c.type}`),
);
console.log("scene children:", JSON.stringify(list));
for (let i = 0; ; i++) {
  const name = await page.evaluate((idx) => {
    const scene = window.__reef.scene;
    if (idx >= scene.children.length) return null;
    for (const [j, child] of scene.children.entries()) child.visible = j !== idx;
    return scene.children[idx].name || scene.children[idx].type;
  }, i);
  if (name === null) break;
  await page.waitForTimeout(300);
  const shot = await page.screenshot({ clip: { x: 396, y: 221, width: 8, height: 8 } });
  // A cheap "is it still violet" check: PNG bytes of a violet patch are
  // stable; log the buffer hash prefix instead of decoding.
  const { createHash } = await import("node:crypto");
  console.log(i, name, createHash("md5").update(shot).digest("hex").slice(0, 8));
}
await browser.close();
