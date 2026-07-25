import { expect, test, type Page } from "@playwright/test";
import { swimToFirstDiscovery } from "./helpers";

/**
 * Sound is the one part of this game that cannot be reviewed from a
 * screenshot, so the soundscape reports its own shape: `window.__reefAudio`
 * exposes the graph's buses, the levels its automation is currently at, and
 * an offline render of the same synthesis the speakers get. Everything below
 * asserts on that rather than on anything anybody can hear.
 */
interface AudioProbe {
  readonly isStarted: boolean;
  readonly contextState: string | null;
  readonly sampleRate: number | null;
  readonly masterVolume: number;
  readonly masterGain: number | null;
  readonly bedCutoff: number | null;
  readonly padGain: number | null;
  readonly duckGain: number | null;
  readonly chimeCount: number;
  readonly bubblesPlayed: number;
  readonly graphNodes: string[];
  probeRms(seconds?: number, volume?: number): Promise<number>;
}

declare global {
  interface Window {
    __reefAudio?: AudioProbe;
    /** Lowest ducking level seen since the watcher was installed. */
    __duckFloor?: number;
  }
}

/** Clicks the canvas — a real gesture — and waits for the graph to come up. */
async function startAudio(page: Page): Promise<string | null> {
  await page.locator("#reef-canvas").click();
  await page.waitForFunction(() => window.__reefAudio?.isStarted === true);
  return page.evaluate(() => window.__reefAudio?.contextState ?? null);
}

test("the reef is silent until the player touches it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?reset=1");

  // No gesture yet: the handle exists, the hardware does not.
  const before = await page.evaluate(() => ({
    started: window.__reefAudio?.isStarted,
    state: window.__reefAudio?.contextState,
    nodes: window.__reefAudio?.graphNodes,
  }));
  expect(before.started).toBe(false);
  expect(before.state).toBeNull();
  expect(before.nodes).toEqual([]);

  const state = await startAudio(page);
  expect(["running", "suspended"]).toContain(state);

  const after = await page.evaluate(() => ({
    sampleRate: window.__reefAudio?.sampleRate ?? 0,
    volume: window.__reefAudio?.masterVolume ?? -1,
    cutoff: window.__reefAudio?.bedCutoff ?? -1,
    padGain: window.__reefAudio?.padGain ?? -1,
    duck: window.__reefAudio?.duckGain ?? -1,
    bubbles: window.__reefAudio?.bubblesPlayed ?? -1,
    nodes: window.__reefAudio?.graphNodes ?? [],
  }));

  expect(after.sampleRate).toBeGreaterThan(8000);
  // The default comfort setting, not whatever the graph happens to sit at.
  expect(after.volume).toBeCloseTo(0.7, 2);
  expect(after.nodes).toEqual([
    "bed",
    "pad",
    "ambience",
    "duck",
    "soften",
    "chimeBus",
    "bubbleBus",
    "master",
  ]);
  // The dive's voicing: a dark bed, no pad, nothing ducked, nobody swimming.
  expect(after.cutoff).toBeCloseTo(420, 0);
  expect(after.padGain).toBeLessThan(0.001);
  expect(after.duck).toBeCloseTo(1, 2);
  expect(after.bubbles).toBe(0);

  expect(errors).toEqual([]);
});

test("a keypress starts the soundscape too", async ({ page }) => {
  await page.goto("/?reset=1");
  expect(await page.evaluate(() => window.__reefAudio?.isStarted)).toBe(false);

  // Whichever gesture comes first has to do: a player who never clicks the
  // canvas and swims straight off the keyboard still gets a reef with a voice.
  await page.keyboard.press("KeyH");
  await page.waitForFunction(() => window.__reefAudio?.isStarted === true);
});

test("the master gain ramps up rather than switching on", async ({ page }) => {
  await page.goto("/?reset=1");
  const state = await startAudio(page);
  test.skip(state !== "running", "the browser did not allow the context to run");

  await page.waitForFunction(() => (window.__reefAudio?.masterGain ?? 0) > 0.1);
  const gain = await page.evaluate(() => window.__reefAudio?.masterGain ?? 0);
  expect(gain).toBeLessThanOrEqual(0.71);
});

test("the offline render carries signal, and silence when the level is zero", async ({ page }) => {
  await page.goto("/?reset=1");
  await startAudio(page);

  // Same builders, rendered through an OfflineAudioContext: proof that the
  // ambience bed and the chime actually produce a waveform.
  const loud = await page.evaluate(() => window.__reefAudio?.probeRms(1.2, 0.7) ?? 0);
  expect(loud).toBeGreaterThan(0.005);

  const silent = await page.evaluate(() => window.__reefAudio?.probeRms(1.2, 0) ?? -1);
  expect(silent).toBe(0);
});

test("the volume slider drives the mix, sleeps the context at zero, and persists", async ({
  page,
}) => {
  await page.goto("/?reset=1");
  const state = await startAudio(page);

  await page.keyboard.press("KeyO");
  const volume = page.locator("#opt-volume");
  await expect(volume).toHaveValue("0.7");
  await expect(page.locator("#opt-volume-value")).toHaveText("70");

  await volume.fill("0.3");
  await expect(page.locator("#opt-volume-value")).toHaveText("30");
  expect(await page.evaluate(() => window.__reefAudio?.masterVolume)).toBeCloseTo(0.3, 2);

  // Zero is silence, and silence should not keep an audio thread busy.
  await volume.fill("0");
  await expect(page.locator("#opt-volume-value")).toHaveText("0");
  expect(await page.evaluate(() => window.__reefAudio?.masterVolume)).toBe(0);
  if (state === "running") {
    await page.waitForFunction(() => window.__reefAudio?.contextState === "suspended");

    await volume.fill("0.5");
    await page.waitForFunction(() => window.__reefAudio?.contextState === "running");
  } else {
    await volume.fill("0.5");
  }

  await page.goto("/");
  await page.keyboard.press("KeyO");
  await expect(page.locator("#opt-volume")).toHaveValue("0.5");
  await expect(page.locator("#opt-volume-value")).toHaveText("50");
});

test("Calm Mode turns the reef down without silencing it", async ({ page }) => {
  await page.goto("/?reset=1");
  await startAudio(page);

  await page.keyboard.press("KeyO");
  await page.locator("#settings-calm").click();

  await expect(page.locator("#opt-volume")).toHaveValue("0.4");
  expect(await page.evaluate(() => window.__reefAudio?.masterVolume ?? 0)).toBeGreaterThan(0);
});

test("the sanctuary opens the bed up and fades its pad in", async ({ page }) => {
  await page.goto("/?reset=1");
  const state = await startAudio(page);
  test.skip(state !== "running", "the browser did not allow the context to run");

  await page.keyboard.press("KeyV");
  await expect(page.getByTestId("sanctuary-overlay")).toBeVisible();
  await page.waitForFunction(
    () => (window.__reefAudio?.bedCutoff ?? 0) > 690 && (window.__reefAudio?.padGain ?? 0) > 0.03,
    undefined,
    { timeout: 15_000 },
  );

  await page.keyboard.press("KeyV");
  await page.waitForFunction(
    () => (window.__reefAudio?.bedCutoff ?? 999) < 430 && (window.__reefAudio?.padGain ?? 1) < 0.01,
    undefined,
    { timeout: 15_000 },
  );
});

test("a discovery rings the chime, ducks the bed, and a swim makes bubbles", async ({ page }) => {
  // Boots the reef and swims a full discovery, so it needs the same budget
  // the save spec does on a software renderer.
  test.slow();

  await page.goto("/?reset=1");
  const state = await startAudio(page);

  // The duck is a second long and the swim finishes on its own schedule, so
  // watch for the dip from inside the page rather than trying to catch it.
  await page.evaluate(() => {
    window.__duckFloor = 1;
    const watch = (): void => {
      const level = window.__reefAudio?.duckGain;
      if (typeof level === "number") {
        window.__duckFloor = Math.min(window.__duckFloor ?? 1, level);
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });

  await swimToFirstDiscovery(page);

  const result = await page.evaluate(() => ({
    chimes: window.__reefAudio?.chimeCount ?? 0,
    bubbles: window.__reefAudio?.bubblesPlayed ?? 0,
    duckFloor: window.__duckFloor ?? 1,
  }));
  expect(result.chimes).toBe(1);
  expect(result.bubbles).toBeGreaterThan(0);
  if (state === "running") {
    // -2dB is 0.794; anything below unity proves the bed stepped back.
    expect(result.duckFloor).toBeLessThan(0.95);
  }
});
