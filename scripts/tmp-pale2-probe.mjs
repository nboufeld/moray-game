import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultNavigationTimeout(600000);
page.setDefaultTimeout(600000);
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 300)); });
await page.goto("http://localhost:5208/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("pale-passage-2"));
await page.waitForTimeout(2000);
// the-lamp pose from the def
const info = await page.evaluate(async () => {
  const reg = window.__reefRegions.defs.find((d) => d.slotId === "pale-passage-2");
  const pose = reg.capturePoses.find((p) => p.name === "the-lamp");
  window.__reef.capture({ position: [...pose.position], yaw: pose.yaw, pitch: pose.pitch, settle: pose.settle });
  await new Promise((r) => setTimeout(r, 4000));
  return { pose: pose.position, yaw: pose.yaw };
});
console.log("posed at", JSON.stringify(info));
await page.waitForTimeout(4000);
await page.screenshot({ path: "/tmp/pale2-probe-lamp.png" });
const state = await page.evaluate(() => {
  const g = window.__reef;
  return {
    renderScale: g.renderScale,
    cam: g.cameraPosition ? [...g.cameraPosition] : null,
  };
});
console.log("state", JSON.stringify(state));
await browser.close();
