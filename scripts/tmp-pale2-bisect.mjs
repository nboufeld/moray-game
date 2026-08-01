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
const sets = {
  "emissive-chunk": ["pale2-paper-fans", "pale2-lantern-anemones", "pale2-pool-pearls", "pale2-lamp-heart", "pale2-lantern-drift", "pale2-lampwright"],
  "first-half": null, // children 0..24 of region
  "second-half": null, // children 25..end
};
for (const [label, names] of Object.entries(sets)) {
  await page.evaluate(([lbl, list]) => {
    let region = null;
    window.__reef.scene.traverse((n) => { if (n.name === "region-pale-passage-2") region = n; });
    for (const [j, child] of region.children.entries()) {
      if (list) child.visible = !list.includes(child.name);
      else if (lbl === "first-half") child.visible = j >= 25;
      else child.visible = j < 25;
    }
  }, [label, names]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/pale2-bisect-${label}.png` });
  console.log("captured", label);
}
await browser.close();
