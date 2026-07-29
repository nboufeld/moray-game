import { chromium } from "@playwright/test";

// Clean A/B: hide a named region child BEFORE the one capture, screenshot.
const HIDE = process.argv[2] ?? "";
const POSE = process.argv[3] ?? "steppe-sea";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("great-blue-1"));

const hidden = await page.evaluate((hide) => {
  const names = [];
  if (!hide) {
    return names;
  }
  window.__reef.scene.traverse((node) => {
    if (node.name && node.name.includes(hide)) {
      node.visible = false;
      names.push(node.name);
    }
  });
  return names;
}, HIDE);
console.log("hidden:", hidden);

await page.evaluate(
  (poseName) => {
    const def = window.__reefRegions.defs.find((d) => d.slotId === "great-blue-1");
    const pose = def.capturePoses.find((p) => p.name === poseName);
    return window.__reef.capture({
      position: [...pose.position],
      yaw: pose.yaw,
      pitch: pose.pitch,
      settle: 2.5,
    });
  },
  POSE,
);
await page.waitForTimeout(250);
await page.screenshot({ path: `visual-qa/tmp-ab-${POSE}${HIDE ? "-no-" + HIDE : ""}.png` });
await browser.close();
