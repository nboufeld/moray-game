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
// Baseline: all hidden.
await page.evaluate(() => {
  let region = null;
  window.__reef.scene.traverse((n) => { if (n.name === "region-pale-passage-2") region = n; });
  for (const child of region.children) child.visible = false;
});
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/pale2-solo-none.png" });
// Show one child at a time; a violet mid-pixel marks an offender.
const count = await page.evaluate(() => {
  let region = null;
  window.__reef.scene.traverse((n) => { if (n.name === "region-pale-passage-2") region = n; });
  return region.children.length;
});
const offenders = [];
for (let i = 0; i < count; i++) {
  const name = await page.evaluate((idx) => {
    let region = null;
    window.__reef.scene.traverse((n) => { if (n.name === "region-pale-passage-2") region = n; });
    for (const [j, child] of region.children.entries()) child.visible = j === idx;
    return region.children[idx].name || region.children[idx].type;
  }, i);
  await page.waitForTimeout(250);
  const shot = await page.screenshot({ clip: { x: 398, y: 223, width: 2, height: 2 } });
  // Decode the 2x2 PNG via the page itself for a pixel value.
  const pix = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 2; c.height = 2;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  }, shot.toString("base64"));
  const violet = Math.abs(pix[0] - 43) < 14 && Math.abs(pix[1] - 36) < 14 && Math.abs(pix[2] - 81) < 14;
  console.log(i, name, JSON.stringify(pix), violet ? "OFFENDER" : "");
  if (violet) offenders.push(`${i}:${name}`);
}
console.log("offenders:", JSON.stringify(offenders));
await browser.close();
