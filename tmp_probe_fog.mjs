// Temporary debug probe — not part of the branch's shipped files.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("http://localhost:5182/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("pale-passage-1"));
await page.waitForTimeout(3000);

for (const name of process.argv.slice(2)) {
  const pose = await page.evaluate((n) => {
    const def = window.__reefRegions.defs.find((d) => d.slotId === "pale-passage-1");
    return def.capturePoses.find((p) => p.name === n);
  }, name);
  await page.evaluate(
    (p) =>
      window.__reef.capture({ position: [...p.position], yaw: p.yaw, pitch: p.pitch, settle: p.settle }),
    pose,
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/pale-quick-${name}.png` });
  console.log(`shot /tmp/pale-quick-${name}.png`);
}
await browser.close();
