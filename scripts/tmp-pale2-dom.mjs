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
  await new Promise((r) => setTimeout(r, 3000));
});
const overlays = await page.evaluate(() => {
  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (
      r.width >= innerWidth * 0.9 &&
      r.height >= innerHeight * 0.9 &&
      cs.visibility !== "hidden" &&
      cs.display !== "none" &&
      (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.opacity !== "1" || el.tagName === "CANVAS")
    ) {
      out.push({
        tag: el.tagName,
        cls: el.className?.toString?.().slice(0, 80),
        bg: cs.backgroundColor,
        opacity: cs.opacity,
        z: cs.zIndex,
      });
    }
  }
  return out;
});
console.log(JSON.stringify(overlays, null, 1));
await browser.close();
