import { chromium } from "@playwright/test";

// Reproduce the invalid-program error WITHOUT the region: spawn only.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
let sawError = false;
page.on("console", (m) => {
  const text = m.text();
  if (/program not valid|Shader Error/i.test(text)) {
    if (!sawError) {
      console.log("console:", text.slice(0, 900));
    }
    sawError = true;
  }
});
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
// Let the bowl render for a while, no region, no capture.
await page.waitForTimeout(6000);
console.log("bowl-only saw error:", sawError);

// Now pose INSIDE the canyon/abyss where the veil lives, still no region.
await page.evaluate(() =>
  window.__reef.capture({ position: [40, -6, 35], yaw: 2.2, pitch: 0, settle: 2 }),
);
await page.waitForTimeout(300);
console.log("after canyon-ish capture saw error:", sawError);
await browser.close();
