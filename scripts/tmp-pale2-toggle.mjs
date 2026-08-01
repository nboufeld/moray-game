import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.setDefaultNavigationTimeout(600000);
page.setDefaultTimeout(600000);
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
await page.goto("http://localhost:5208/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("pale-passage-2"));
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const reg = window.__reefRegions.defs.find((d) => d.slotId === "pale-passage-2");
  const pose = reg.capturePoses.find((p) => p.name === "the-lamp");
  window.__reef.capture({ position: [...pose.position], yaw: pose.yaw, pitch: pose.pitch, settle: 2 });
  await new Promise((r) => setTimeout(r, 2500));
});
// List the region group's children.
const names = await page.evaluate(() => {
  let region = null;
  window.__reef.scene?.traverse?.((n) => {
    if (n.name === "region-pale-passage-2") region = n;
  });
  if (!region) {
    // Fall back: find via any exposed scene handle.
    return null;
  }
  return region.children.map((c, i) => `${i}:${c.name || c.type}`);
});
console.log("children:", JSON.stringify(names));
// Mid-screen pixel sampler.
async function midPixel() {
  const shot = await page.screenshot({ clip: { x: 400, y: 225, width: 4, height: 4 } });
  return shot.toString("base64").slice(0, 24);
}
// Toggle each child off, screenshot, report whether the frame changed
// from flat violet (sample the mid pixel via canvas readback instead).
const result = await page.evaluate(async () => {
  let region = null;
  window.__reef.scene?.traverse?.((n) => {
    if (n.name === "region-pale-passage-2") region = n;
  });
  if (!region) return "no region";
  return region.children.length;
});
console.log("child count:", result);
for (let i = 0; ; i++) {
  const name = await page.evaluate((idx) => {
    let region = null;
    window.__reef.scene?.traverse?.((n) => {
      if (n.name === "region-pale-passage-2") region = n;
    });
    if (!region || idx >= region.children.length) return null;
    for (const [j, child] of region.children.entries()) child.visible = j !== idx;
    return region.children[idx].name || region.children[idx].type;
  }, i);
  if (name === null) break;
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/tmp/pale2-toggle-${String(i).padStart(2, "0")}-${name.replace(/[^a-z0-9-]/gi, "_")}.png` });
  console.log(`captured toggle ${i} (hidden: ${name})`);
}
await browser.close();
