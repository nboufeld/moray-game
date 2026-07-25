/**
 * Measures the soundscape, because nobody reviewing this repository can hear
 * it and a screenshot has nothing to say about a bell.
 *
 *   node scripts/probe-audio.mjs [label]      (with `npm run dev` running)
 *
 * It imports the game's own synthesis modules inside the page, renders each
 * layer through an `OfflineAudioContext`, and prints what the waveform turned
 * out to be: where the bell's energy sits and how fast it decays, how steeply
 * the ambience bed rolls off (a bed with energy up at 4kHz is a bed that will
 * fatigue), whether the bubble really sweeps downward, and how big the step
 * across the noise loop's seam is compared with an ordinary sample step.
 *
 * These are relative numbers for comparing a tuning change against the version
 * before it — exactly like `measure-frames.mjs`, but for the ears.
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const label = process.argv[2] ?? "current";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.setDefaultNavigationTimeout(120_000);
page.setDefaultTimeout(120_000);

await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
await page.waitForFunction(() => "__reefAudio" in window);

const report = await page.evaluate(async () => {
  const synth = await import("/src/audio/synth.ts");
  const { Random, SEEDS } = await import("/src/util/Random.ts");
  const RATE = 44100;

  /** Amplitude at one frequency, by Goertzel — no FFT needed for a few bins. */
  const bin = (samples, frequency) => {
    const k = 2 * Math.cos((2 * Math.PI * frequency) / RATE);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const s0 = samples[i] + k * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return Math.sqrt(Math.abs(s1 * s1 + s2 * s2 - k * s1 * s2)) / samples.length;
  };

  const rms = (samples, from = 0, to = samples.length) => {
    let sum = 0;
    for (let i = from; i < to; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / Math.max(1, to - from));
  };

  const render = async (seconds, build) => {
    const context = new window.OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
    const out = context.createGain();
    out.connect(context.destination);
    build(context, out);
    const buffer = await context.startRendering();
    return buffer.getChannelData(0);
  };

  const window_ = (samples, fromSeconds, toSeconds) =>
    samples.subarray(Math.floor(fromSeconds * RATE), Math.floor(toSeconds * RATE));

  // --- The bell ---------------------------------------------------------
  const chime = await render(2.6, (context, out) => synth.playChime(context, out, 0));
  const strike = window_(chime, 0, 0.25);
  const tail = window_(chime, 1.2, 1.6);
  let peak = 0;
  for (let i = 0; i < chime.length; i++) {
    peak = Math.max(peak, Math.abs(chime[i]));
  }

  // --- The bed ----------------------------------------------------------
  const bed = await render(3, (context, out) => {
    synth.buildAmbienceBed(context, new Random(SEEDS.audioBed)).output.connect(out);
  });
  const steady = window_(bed, 1, 3);
  const spectrum = {};
  for (const frequency of [60, 125, 250, 500, 1000, 2000, 4000, 8000]) {
    spectrum[frequency] = bin(steady, frequency);
  }

  // --- The loop seam ----------------------------------------------------
  const seamContext = new window.OfflineAudioContext(1, RATE, RATE);
  const noise = synth
    .createBrownNoiseBuffer(seamContext, synth.AMBIENCE.noiseSeconds, new Random(SEEDS.audioBed))
    .getChannelData(0);
  let stepSum = 0;
  for (let i = 1; i < noise.length; i++) {
    stepSum += Math.abs(noise[i] - noise[i - 1]);
  }
  const meanStep = stepSum / (noise.length - 1);
  const seamStep = Math.abs(noise[0] - noise[noise.length - 1]);

  // --- One bubble -------------------------------------------------------
  const bubble = await render(0.3, (context, out) =>
    synth.playBubble(context, out, 0, new Random(SEEDS.audioBubbles)),
  );
  const bubbleHead = window_(bubble, 0, 0.03);
  const bubbleTail = window_(bubble, 0.1, 0.15);

  return {
    chime: {
      peak,
      strikeRms: rms(strike),
      tailRms: rms(tail),
      notes: synth.CHIME.notes.map((frequency) => ({
        frequency,
        strike: bin(strike, frequency),
      })),
      glare: bin(window_(chime, 0, 0.5), 6000),
    },
    bed: { rms: rms(steady), spectrum },
    seam: { meanStep, seamStep, ratio: seamStep / meanStep },
    bubble: {
      peak: Math.max(...Array.from(bubble, Math.abs)),
      startsHigh: bin(bubbleHead, 900) / (bin(bubbleHead, 300) + 1e-9),
      endsLow: bin(bubbleTail, 300) / (bin(bubbleTail, 900) + 1e-9),
    },
  };
});

const f = (value, digits = 4) => value.toFixed(digits);

console.info(`audio probe — ${label}`);
console.info(
  `  chime   peak ${f(report.chime.peak)} | strike rms ${f(report.chime.strikeRms)} ` +
    `-> tail rms ${f(report.chime.tailRms)} (x${f(report.chime.strikeRms / report.chime.tailRms, 1)})`,
);
console.info(
  `          notes ${report.chime.notes.map((n) => `${n.frequency}Hz ${f(n.strike, 5)}`).join("  ")}` +
    ` | 6kHz glare ${f(report.chime.glare, 6)}`,
);
console.info(`  bed     rms ${f(report.bed.rms)}`);
console.info(
  `          ${Object.entries(report.bed.spectrum)
    .map(([frequency, level]) => `${frequency}Hz ${f(level, 6)}`)
    .join("  ")}`,
);
console.info(
  `  seam    step ${f(report.seam.seamStep, 6)} vs mean ${f(report.seam.meanStep, 6)} ` +
    `(x${f(report.seam.ratio, 2)})`,
);
console.info(
  `  bubble  peak ${f(report.bubble.peak)} | 900/300 at onset ${f(report.bubble.startsHigh, 2)} ` +
    `| 300/900 at tail ${f(report.bubble.endsLow, 2)}`,
);

await browser.close();
