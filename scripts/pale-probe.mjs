/** One-shot: probe the dev server page load and report console/pageerror. */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5197";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on("console", (message) => console.log(`[console:${message.type()}]`, message.text().slice(0, 300)));
page.on("pageerror", (error) => console.log("[pageerror]", error.message.slice(0, 500)));
page.on("requestfailed", (request) =>
  console.log("[requestfailed]", request.url().slice(0, 200), request.failure()?.errorText),
);

console.log("navigating (domcontentloaded)...");
await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
console.log("dom ready; waiting for __reef...");
try {
  await page.waitForFunction(() => "__reef" in window, undefined, { timeout: 60_000 });
  console.log("__reef present");
} catch {
  console.log("__reef NEVER appeared");
}
try {
  await page.waitForLoadState("load", { timeout: 30_000 });
  console.log("load event fired");
} catch {
  console.log("load event NEVER fired");
}
await browser.close();
