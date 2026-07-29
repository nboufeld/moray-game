import { chromium } from "@playwright/test";

// Find the mesh whose shader program failed to compile.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(180_000);
await page.goto("http://localhost:5183/?reset=1", { waitUntil: "load" });
await page.waitForFunction(() => "__reef" in window);
await page.waitForTimeout(5000);

const report = await page.evaluate(() => {
  const game = window.__reef;
  let renderer = game.renderer ?? game._renderer;
  if (renderer && !renderer.properties) {
    // The adapter wraps the WebGLRenderer; find the wrapped one.
    for (const key of Object.keys(renderer)) {
      const candidate = renderer[key];
      if (candidate && candidate.properties && candidate.render) {
        renderer = candidate;
        break;
      }
    }
  }
  if (!renderer || !renderer.properties) {
    return { error: "no renderer handle", keys: Object.keys(renderer ?? game) };
  }
  const bad = [];
  game.scene.traverse((node) => {
    const material = node.material;
    if (!material) {
      return;
    }
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      const props = renderer.properties.get(mat);
      const programs = props?.programs;
      if (programs) {
        for (const program of programs.values()) {
          if (program.diagnostics && !program.diagnostics.runnable) {
            bad.push({
              node: node.name || node.type,
              parent: node.parent?.name || node.parent?.type,
              material: mat.type,
              log: String(program.diagnostics.programLog).slice(0, 120),
            });
          }
        }
      }
    }
  });
  return { bad };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
