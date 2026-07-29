// Scratch probe (deleted before close): samples the reddest pixels in a
// band of a screenshot, to identify what colour the serpent actually is.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";

const [file, x0 = "300", y0 = "230", x1 = "1300", y1 = "330"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
const data = await readFile(file);
const result = await page.evaluate(
  async ({ dataUrl, box }) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const { data: px } = ctx.getImageData(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    const all = [];
    for (let i = 0; i < px.length; i += 4) {
      all.push([px[i], px[i + 1], px[i + 2]]);
    }
    // Background estimate: median color.
    const med = (k) => all.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(all.length / 2)];
    const bg = [med(0), med(1), med(2)];
    // Fish candidates: pixels much redder than the background.
    const fish = all.filter((p) => p[0] - bg[0] > 30);
    const mean = (arr, k) => Math.round(arr.reduce((s, p) => s + p[k], 0) / Math.max(1, arr.length));
    return {
      background: bg,
      fishCount: fish.length,
      fishMean: [mean(fish, 0), mean(fish, 1), mean(fish, 2)],
    };
  },
  {
    dataUrl: `data:image/png;base64,${data.toString("base64")}`,
    box: { x0: +x0, y0: +y0, x1: +x1, y1: +y1 },
  },
);
console.info(JSON.stringify(result));
await browser.close();
