/**
 * Value statistics for archived shots, and the difference between two of them.
 *
 *   node scripts/frame-stats.mjs <before.png> <after.png>
 *   node scripts/frame-stats.mjs <shot.png>
 *
 * Half the notes in AGENTS.md rest on a measurement of this kind — "the
 * canonical shots hold their frame mean to within one part in 255 across the
 * swap", "0.35 measured eight parts in 255 of lift" — and the eye is very bad
 * at it. A frame that has quietly gained ten parts everywhere looks like a
 * frame with better lighting, right up until it is next to the one it replaced.
 * The tenth percentile is the one to watch: it is where a veil of additive
 * light shows up first, because it lifts the darks and leaves the highlights
 * where they were.
 *
 * The HUD is excluded — it is opaque CSS over the corners and it would drag
 * every number toward its own two colours.
 *
 * Decoding goes through a headless Chromium rather than a PNG library, for the
 * same reason the probes read pixels back from the real framebuffer: it is the
 * decoder the screenshots were written by, and this project already depends on
 * it.
 */
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const files = process.argv.slice(2);
if (files.length === 0 || files.length > 2) {
  console.error("usage: node scripts/frame-stats.mjs <before.png> [after.png]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();

const read = async (file) => {
  const data = await readFile(file);
  return page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // The overlays: the objective plate top-left and the controls card
    // bottom-left, both opaque and both fixed.
    const masked = (x, y) =>
      (x < canvas.width * 0.13 && y < canvas.height * 0.12) ||
      (x < canvas.width * 0.13 && y > canvas.height * 0.75);

    const luma = [];
    const channel = [[], [], []];
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (masked(x, y)) {
          continue;
        }
        const i = (y * canvas.width + x) * 4;
        for (let c = 0; c < 3; c++) {
          channel[c].push(pixels[i + c]);
        }
        luma.push(0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]);
      }
    }

    const summarise = (values) => {
      const sorted = values.slice().sort((a, b) => a - b);
      const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
      return {
        mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        p10: at(0.1),
        p50: at(0.5),
        p90: at(0.9),
        p99: at(0.99),
      };
    };

    return {
      size: `${canvas.width}x${canvas.height}`,
      luma: summarise(luma),
      r: summarise(channel[0]),
      g: summarise(channel[1]),
      b: summarise(channel[2]),
    };
  }, `data:image/png;base64,${data.toString("base64")}`);
};

const line = (label, s) =>
  `${label.padEnd(9)} mean ${s.mean.toFixed(1).padStart(6)} | p10 ${s.p10.toFixed(1).padStart(5)} ` +
  `p50 ${s.p50.toFixed(1).padStart(5)} p90 ${s.p90.toFixed(1).padStart(5)} ` +
  `p99 ${s.p99.toFixed(1).padStart(5)}`;

const stats = [];
for (const file of files) {
  const s = await read(file);
  stats.push(s);
  console.info(`${path.basename(file)} (${s.size})`);
  console.info(`  ${line("luma", s.luma)}`);
  for (const [name, key] of [
    ["red", "r"],
    ["green", "g"],
    ["blue", "b"],
  ]) {
    console.info(`  ${line(name, s[key])}`);
  }
}

if (stats.length === 2) {
  const [before, after] = stats;
  const delta = (key) => {
    const d = (field) => {
      const value = after[key][field] - before[key][field];
      return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
    };
    console.info(
      `  ${key.padEnd(9)} mean ${d("mean").padStart(6)} | p10 ${d("p10").padStart(5)} ` +
        `p50 ${d("p50").padStart(5)} p90 ${d("p90").padStart(5)} p99 ${d("p99").padStart(5)}`,
    );
  };
  console.info("difference (after - before)");
  for (const key of ["luma", "r", "g", "b"]) {
    delta(key);
  }
}

await browser.close();
