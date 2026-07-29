import { chromium } from "@playwright/test";

const HIDE = process.argv[2] ?? "";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.evaluate(() => window.__reef.forceRegion("great-blue-1"));

const pose = await page.evaluate(() => {
  const def = window.__reefRegions.defs.find((d) => d.slotId === "great-blue-1");
  return def.capturePoses.find((p) => p.name === "steppe-sea");
});
await page.evaluate(
  (p) =>
    window.__reef.capture({
      position: [...p.position],
      yaw: p.yaw,
      pitch: p.pitch,
      settle: p.settle,
    }),
  pose,
);
await page.waitForTimeout(250);

const report = await page.evaluate((hide) => {
  const scene = window.__reef.scene;
  let root = null;
  scene.traverse((node) => {
    if (node.name === "region-great-blue-1") {
      root = node;
    }
  });
  if (!root) {
    return { error: "region group not found" };
  }
  const out = [];
  for (const child of root.children) {
    if (hide && child.name.includes(hide)) {
      child.visible = false;
    }
    const geometry = child.geometry;
    let bs = null;
    if (geometry) {
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const s = geometry.boundingSphere;
      bs = s
        ? {
            c: [s.center.x, s.center.y, s.center.z].map((n) => +n.toFixed(1)),
            r: +s.radius.toFixed(1),
          }
        : null;
    }
    out.push({
      name: child.name || child.type,
      count: child.count,
      pos: [child.position.x, child.position.y, child.position.z].map((n) => +n.toFixed(1)),
      bs,
    });
  }
  return { children: out };
}, HIDE);
console.log(JSON.stringify(report, null, 1));

if (HIDE) {
  await page.evaluate((p) =>
    window.__reef.capture({ position: [...p.position], yaw: p.yaw, pitch: p.pitch, settle: 0.5 }),
    pose,
  );
  await page.waitForTimeout(250);
}
await page.screenshot({ path: `visual-qa/tmp-debug${HIDE ? "-no-" + HIDE : ""}.png` });
await browser.close();
