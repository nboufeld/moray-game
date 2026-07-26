/**
 * Value statistics for an authored asset, straight off the decoded file.
 *
 *   node scripts/image-stats.mjs <image.png> [--rows <top> <count>] [--grid <n>]
 *
 * `frame-stats.mjs` measures a rendered frame; this measures the painting that
 * goes into one, which is the number every integration constant in
 * `UnderwaterFog` and `RockMaterial` is derived against. Same decoder — a
 * headless Chromium — for the same reason: it is the one the browser will use.
 *
 * `--rows` reports a horizontal strip on its own, which is how the fog colour
 * is sampled. `--grid` reports an n×n block average, which is how a wash's
 * colour patches are told from its noise.
 */
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error("usage: node scripts/image-stats.mjs <image.png> [--rows <top> <count>] [--grid <n>]");
  process.exit(1);
}

const rowsAt = args.indexOf("--rows");
const rows = rowsAt >= 0 ? [Number(args[rowsAt + 1]), Number(args[rowsAt + 2])] : null;
const gridAt = args.indexOf("--grid");
const grid = gridAt >= 0 ? Number(args[gridAt + 1]) : 0;

const browser = await chromium.launch();
const page = await browser.newPage();
const data = await readFile(file);

const report = await page.evaluate(
  async ([dataUrl, strip, blocks]) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const summarise = (values) => {
      const sorted = values.slice().sort((a, b) => a - b);
      const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
      return {
        mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        min: sorted[0],
        p01: at(0.01),
        p10: at(0.1),
        p50: at(0.5),
        p90: at(0.9),
        p99: at(0.99),
        max: sorted[sorted.length - 1],
      };
    };

    const region = (x0, y0, x1, y1) => {
      const luma = [];
      const channel = [[], [], []];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * canvas.width + x) * 4;
          for (let c = 0; c < 3; c++) {
            channel[c].push(pixels[i + c]);
          }
          luma.push(0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]);
        }
      }
      return { luma: summarise(luma), r: summarise(channel[0]), g: summarise(channel[1]), b: summarise(channel[2]) };
    };

    // Linear-light luminance of the whole image, which is the space every
    // integration constant here is a multiply in.
    const toLinear = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    let linear = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      linear +=
        0.2126 * toLinear(pixels[i]) + 0.7152 * toLinear(pixels[i + 1]) + 0.0722 * toLinear(pixels[i + 2]);
    }
    linear /= pixels.length / 4;

    const result = {
      size: `${canvas.width}x${canvas.height}`,
      whole: region(0, 0, canvas.width, canvas.height),
      linear,
    };

    if (strip) {
      const top = Math.max(0, Math.min(canvas.height - 1, Math.round(strip[0])));
      const count = Math.max(1, Math.min(canvas.height - top, Math.round(strip[1])));
      result.strip = { top, count, stats: region(0, top, canvas.width, top + count) };
    }

    // How dark the darkest band of the painting gets, row by row: the electric
    // -cyan failure is a red channel near zero, and it lives in whole rows.
    const rowScan = [];
    for (let y = 0; y < canvas.height; y += Math.max(1, Math.floor(canvas.height / 16))) {
      const s = region(0, y, canvas.width, Math.min(canvas.height, y + 1));
      rowScan.push({ y, r: s.r.mean, g: s.g.mean, b: s.b.mean, rMin: s.r.min });
    }
    result.rowScan = rowScan;

    if (blocks > 0) {
      const cells = [];
      const w = Math.floor(canvas.width / blocks);
      const h = Math.floor(canvas.height / blocks);
      for (let by = 0; by < blocks; by++) {
        const row = [];
        for (let bx = 0; bx < blocks; bx++) {
          const s = region(bx * w, by * h, (bx + 1) * w, (by + 1) * h);
          row.push([Math.round(s.r.mean), Math.round(s.g.mean), Math.round(s.b.mean)]);
        }
        cells.push(row);
      }
      result.grid = cells;
    }

    return result;
  },
  [`data:image/png;base64,${data.toString("base64")}`, rows, grid],
);

const line = (label, s) =>
  `${label.padEnd(7)} mean ${s.mean.toFixed(1).padStart(6)} | min ${String(s.min).padStart(3)} ` +
  `p01 ${String(s.p01).padStart(3)} p10 ${String(s.p10).padStart(3)} p50 ${String(s.p50).padStart(3)} ` +
  `p90 ${String(s.p90).padStart(3)} p99 ${String(s.p99).padStart(3)} max ${String(s.max).padStart(3)}`;

const block = (label, stats) => {
  console.info(label);
  console.info(`  ${line("luma", stats.luma)}`);
  console.info(`  ${line("red", stats.r)}`);
  console.info(`  ${line("green", stats.g)}`);
  console.info(`  ${line("blue", stats.b)}`);
};

console.info(`${path.basename(file)} (${report.size})`);
block("whole image", report.whole);
console.info(`  linear luminance ${report.linear.toFixed(4)}`);

if (report.strip) {
  block(`strip rows ${report.strip.top}..${report.strip.top + report.strip.count - 1}`, report.strip.stats);
}

console.info("row scan (mean per channel, and the row's darkest red)");
for (const r of report.rowScan) {
  console.info(
    `  y ${String(r.y).padStart(4)}  r ${r.r.toFixed(1).padStart(6)} g ${r.g.toFixed(1).padStart(6)} ` +
      `b ${r.b.toFixed(1).padStart(6)}  rMin ${String(r.rMin).padStart(3)}`,
  );
}

if (report.grid) {
  console.info(`${report.grid.length}x${report.grid.length} block means (r,g,b)`);
  for (const row of report.grid) {
    console.info(`  ${row.map((c) => c.map((v) => String(v).padStart(3)).join(",")).join("  ")}`);
  }
}

await browser.close();
