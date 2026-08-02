/**
 * BATCH 4 (journey close) — captures a whole province spoke's journey as
 * ONE streamed swim: bowl → gateway wing → wing door → approach vale →
 * depth-1 heart → depth-1→2 pass crossing (both directions) → depth-2
 * heart → depth-2→3 crossing (both directions) → depth-3 heart → the
 * terminus horizon.
 *
 *   node scripts/journey-shots.mjs <spoke> <change-tag>
 *   spokes: verdant | smoking | pale | great-blue | golden | calamity
 *
 * Unlike region-shots.mjs this NEVER calls forceRegion: the transitions
 * are the thing under test (mood handoff, terrain seam, corridor
 * colliders, ring gaps, veils), so regions must attach and detach through
 * the streamer's own distance logic. The whole chain therefore runs in a
 * single page session, in journey order — each capture's settle steps
 * advance the streamer, so by the time a pose is framed the country ahead
 * of it has attached exactly the way it would under a real swim. The one
 * teleport rule this imposes: every pose must stand inside a volume the
 * PREVIOUS pose left attached (bowl box, wing annex, or an attached
 * region's weight>0 domain), otherwise the collision box claps the diver
 * home before the streamer can catch up. The chains below honour that by
 * construction, and the script verifies it: a pose whose settled diver
 * position is > 2 m from the request is reported as DISPLACED.
 *
 * SHOT_URL / SHOT_PER_LAUNCH / SHOT_NO_ASSETS / SHOT_NAV_TIMEOUT /
 * SHOT_COMPILE_WAIT per the shared harness idiom (region-shots.mjs).
 * Under SHOT_PER_LAUNCH=1 each pose gets a fresh Chromium, and the chain
 * PREFIX is replayed (settle clamped to 0.6 s) to rebuild the streaming
 * state a real swim would have left behind.
 *
 * Poses come from two sources so the script and the game cannot disagree:
 *   - `ref` entries read the named authored pose out of the def's own
 *     capturePoses at runtime;
 *   - `custom` entries are authored HERE in spoke coordinates (u along
 *     the azimuth, v lateral CCW — the regions' own convention) and are
 *     resolved in-page against the defs' live terrainTarget functions
 *     (y = max over the named slots' composed floors + lift, the
 *     max() rule the MASTER field note prescribes for cross-region
 *     ground). These are the mid-pass crossing poses the per-region sets
 *     never authored: both directions at each seam.
 *
 * Every resolved pose is also printed as a `SHOT_AT=` line so the headed
 * perf pass (measure-frames.mjs) can be pointed at the exact same water.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5173";
const OUT_DIR = path.resolve("visual-qa");
const SEED = "seed1";
const QUALITY = "hi";
const VIEWPORT = { width: 1600, height: 900 };
const NAV_TIMEOUT_MS = Number(process.env.SHOT_NAV_TIMEOUT ?? 180_000);
const COMPILE_WAIT_MS = Number(process.env.SHOT_COMPILE_WAIT ?? 900);
const perLaunch = process.env.SHOT_PER_LAUNCH === "1";
/** Replay settle for prefix poses under per-launch: enough sim steps for
 * the streamer to attach/detach exactly as the full chain would (attach
 * happens on the first step; 0.6 s = 36 steps of margin). */
const REPLAY_SETTLE = 0.6;

// ─── The chains ──────────────────────────────────────────────────────────────

/**
 * Wing floor depths (WingDef.carve.floorDepth) for the gateway
 * antechamber poses — the wings are not regions, so their floors are not
 * reachable through __reefRegions; these are the defs' own numbers.
 */
const WING_FLOOR = {
  verdant: -5.5, // kelp-cathedral
  smoking: -7.5, // vent-springs
  pale: -4.2, // ghost-reef
  "great-blue": -14, // open-blue
  golden: -5.0, // sandfall-dunes
  calamity: -6.6, // ruins-terrace
};

const AZIMUTH = {
  verdant: 1.35,
  smoking: 2.79,
  pale: 3.87,
  "great-blue": 5.31,
  golden: 6.39,
  calamity: 4.59,
};

/**
 * The shared spine of every three-region spoke. Seam geometry is uniform
 * across the world map (discs 225–665 / 720–1160 / 1240–1680 on the
 * spoke; pass tongues reach 30 m inside the shallower disc), so the
 * crossing poses sit at the same u everywhere: the forward pose stands in
 * the shallower country looking through the corridor into the next, the
 * back pose stands in the new country looking home.
 */
function spokeChain(spoke, names) {
  const wingFloor = WING_FLOOR[spoke];
  return [
    { name: "bowl", u: 18, v: 0, absoluteY: 2.0, atU: 50, atV: 0, pitch: 0, settle: 2.5 },
    {
      name: "wing-hall",
      u: 38,
      v: 0,
      absoluteY: wingFloor + 3.0,
      atU: 52,
      atV: 0,
      pitch: 0.02,
      settle: 2.5,
    },
    {
      name: "wing-door",
      u: 47,
      v: 0,
      absoluteY: wingFloor + 2.5,
      atU: 130,
      atV: 0,
      pitch: -0.02,
      settle: 2.5,
    },
    { ref: names.vale },
    { ref: names.heart1 },
    {
      name: "pass12-fwd",
      u: 648,
      v: 0,
      lift: names.passLift ?? 2.4,
      floors: [names.slot1, names.slot2],
      atU: 745,
      atV: 0,
      pitch: -0.02,
      settle: 3,
    },
    {
      name: "pass12-back",
      u: 736,
      v: 0,
      lift: names.passLift ?? 2.4,
      floors: [names.slot1, names.slot2],
      atU: 628,
      atV: 0,
      pitch: -0.02,
      settle: 3,
    },
    { ref: names.arrival2 },
    { ref: names.heart2 },
    {
      name: "pass23-fwd",
      u: 1146,
      v: 0,
      lift: names.passLift ?? 2.4,
      floors: [names.slot2, names.slot3],
      atU: 1242,
      atV: 0,
      pitch: -0.02,
      settle: 3,
    },
    {
      name: "pass23-back",
      u: 1231,
      v: 0,
      lift: names.passLift ?? 2.4,
      floors: [names.slot2, names.slot3],
      atU: 1120,
      atV: 0,
      pitch: -0.02,
      settle: 3,
    },
    { ref: names.arrival3 },
    { ref: names.heart3 },
    { ref: names.terminus },
  ];
}

const CHAINS = {
  verdant: spokeChain("verdant", {
    slot1: "verdant-line-1",
    slot2: "verdant-line-2",
    slot3: "verdant-line-3",
    vale: ["verdant-line-1", "vale-reveal"],
    heart1: ["verdant-line-1", "sunwell"],
    arrival2: ["verdant-line-2", "pass-threshold"],
    heart2: ["verdant-line-2", "cistern"],
    arrival3: ["verdant-line-3", "pass-threshold"],
    heart3: ["verdant-line-3", "twin-court"],
    terminus: ["verdant-line-3", "provinces-end"],
  }),
  smoking: spokeChain("smoking", {
    slot1: "smoking-marches-1",
    slot2: "smoking-marches-2",
    slot3: "smoking-marches-3",
    vale: ["smoking-marches-1", "gorge-lip"],
    heart1: ["smoking-marches-1", "caldera-rim"],
    arrival2: ["smoking-marches-2", "saddle-crest"],
    heart2: ["smoking-marches-2", "anvil"],
    arrival3: ["smoking-marches-3", "night-threshold"],
    heart3: ["smoking-marches-3", "the-choir"],
    terminus: ["smoking-marches-3", "ember-dawn"],
  }),
  pale: spokeChain("pale", {
    slot1: "pale-passage-1",
    slot2: "pale-passage-2",
    slot3: "pale-passage-3",
    vale: ["pale-passage-1", "lip-reveal"],
    heart1: ["pale-passage-1", "mother-crown"],
    arrival2: ["pale-passage-2", "pass-threshold"],
    heart2: ["pale-passage-2", "lantern-gardens"],
    arrival3: ["pale-passage-3", "pass-threshold"],
    heart3: ["pale-passage-3", "daybreak"],
    terminus: ["pale-passage-3", "suns-doorstep"],
  }),
  "great-blue": spokeChain("great-blue", {
    slot1: "great-blue-1",
    slot2: "great-blue-2",
    slot3: "great-blue-3",
    vale: ["great-blue-1", "slope-reveal"],
    heart1: ["great-blue-1", "gnomon"],
    arrival2: ["great-blue-2", "wall-face"],
    heart2: ["great-blue-2", "mooring"],
    arrival3: ["great-blue-3", "wall-crossing"],
    heart3: ["great-blue-3", "daybreak"],
    terminus: ["great-blue-3", "morning-horizon"],
    // The blue crossings span the void (the Worldwall keeps its full
    // column — R0.6/R0.9), so the swim-line rides high over the pour.
    passLift: 10,
  }),
  golden: spokeChain("golden", {
    slot1: "golden-waste-1",
    slot2: "golden-waste-2",
    slot3: "golden-waste-3",
    vale: ["golden-waste-1", "saddle-reveal"],
    heart1: ["golden-waste-1", "oasis"],
    arrival2: ["golden-waste-2", "shore-road"],
    heart2: ["golden-waste-2", "noon-bell"],
    arrival3: ["golden-waste-3", "last-shelf"],
    heart3: ["golden-waste-3", "afterglow-garden"],
    terminus: ["golden-waste-3", "evening-horizon"],
  }),
  // The spur: one region at the end of a 490 m march — no passes, so the
  // "crossings" are the march's own authored beats plus the Wound gate.
  calamity: [
    { name: "bowl", u: 18, v: 0, absoluteY: 2.0, atU: 50, atV: 0, pitch: 0, settle: 2.5 },
    {
      name: "wing-hall",
      u: 38,
      v: 0,
      absoluteY: WING_FLOOR.calamity + 3.0,
      atU: 52,
      atV: 0,
      pitch: 0.02,
      settle: 2.5,
    },
    {
      name: "wing-door",
      u: 47,
      v: 0,
      absoluteY: WING_FLOOR.calamity + 2.5,
      atU: 130,
      atV: 0,
      pitch: -0.02,
      settle: 2.5,
    },
    { ref: ["sunken-calamity-1", "sorrow-gate"] },
    { ref: ["sunken-calamity-1", "mid-march"] },
    { ref: ["sunken-calamity-1", "suffocated-mile"] },
    { ref: ["sunken-calamity-1", "wound-gate"] },
    { ref: ["sunken-calamity-1", "the-reveal"] },
    { ref: ["sunken-calamity-1", "last-grove"] },
    { ref: ["sunken-calamity-1", "quiet-rim"] },
  ],
};

// ─── Harness ─────────────────────────────────────────────────────────────────

const spoke = process.argv[2];
const tag = process.argv[3];
if (!spoke || !tag || !CHAINS[spoke]) {
  console.error(
    "usage: node scripts/journey-shots.mjs <verdant|smoking|pale|great-blue|golden|calamity> <change-tag>",
  );
  process.exit(1);
}

const poseFilter = (process.env.SHOT_POSE_FILTER ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

function stamp() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

async function openPage() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
  if (noAssets) {
    await blockAssets(page);
  }
  await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__reef" in window);
  await waitForAssets(page);
  return { browser, page };
}

/** Resolves the whole chain to world-space poses inside the page. */
async function resolveChain(page, chain, azimuth) {
  return page.evaluate(
    ({ chain, azimuth }) => {
      const registry = window.__reefRegions;
      if (!registry) {
        throw new Error("window.__reefRegions missing — is main.ts exposing it?");
      }
      const defOf = (slot) => {
        const def = registry.defs.find((candidate) => candidate.slotId === slot);
        if (!def) {
          throw new Error(`No registered region for slot ${slot}`);
        }
        return def;
      };
      const ax = Math.cos(azimuth);
      const az = Math.sin(azimuth);
      const worldOf = (u, v) => ({ x: u * ax - v * az, z: u * az + v * ax });
      const yawToward = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));

      return chain.map((entry) => {
        if (entry.ref) {
          const [slot, poseName] = entry.ref;
          const pose = defOf(slot).capturePoses.find((p) => p.name === poseName);
          if (!pose) {
            throw new Error(`No pose ${poseName} in ${slot}`);
          }
          return {
            name: `${slot.replace(/-(line|marches|passage|blue|waste|calamity)-/, "")}-${pose.name}`,
            position: [...pose.position],
            yaw: pose.yaw,
            pitch: pose.pitch,
            settle: pose.settle,
          };
        }
        const { x, z } = worldOf(entry.u, entry.v);
        let y = entry.absoluteY;
        if (y === undefined) {
          let floor = -Infinity;
          for (const slot of entry.floors) {
            floor = Math.max(floor, defOf(slot).terrainTarget(x, z));
          }
          y = floor + entry.lift;
        }
        const at = worldOf(entry.atU, entry.atV);
        return {
          name: entry.name,
          position: [x, y, z],
          yaw: yawToward(x, z, at.x, at.z),
          pitch: entry.pitch,
          settle: entry.settle,
        };
      });
    },
    { chain, azimuth },
  );
}

async function capturePose(page, pose, settleOverride) {
  return page.evaluate(
    ({ pose, settle }) => {
      window.__reef.capture({
        position: pose.position,
        yaw: pose.yaw,
        pitch: pose.pitch,
        settle,
      });
      const dive = window.__reef.divePosition;
      return { dive, active: [...window.__reef.activeRegions] };
    },
    { pose, settle: settleOverride ?? pose.settle },
  );
}

await mkdir(OUT_DIR, { recursive: true });
if (noAssets) {
  console.info("SHOT_NO_ASSETS=1 — capturing the procedural fallback build");
}

const prefix = stamp();
const chain = CHAINS[spoke];
let session = perLaunch ? null : await openPage();
let resolved = session ? await resolveChain(session.page, chain, AZIMUTH[spoke]) : null;

for (let index = 0; index < chain.length; index++) {
  if (perLaunch) {
    session = await openPage();
    resolved = await resolveChain(session.page, chain, AZIMUTH[spoke]);
    // Rebuild the streaming state the journey would have left behind.
    for (let k = 0; k < index; k++) {
      await capturePose(session.page, resolved[k], REPLAY_SETTLE);
      await waitForAssets(session.page);
    }
  }
  const pose = resolved[index];
  const skip = poseFilter.length > 0 && !poseFilter.includes(pose.name);
  if (!skip) {
    await capturePose(session.page, pose);
    // A pose that attached a new region mid-capture may have kicked off
    // that region's authored asset loads; wait them out and re-settle so
    // the shutter never catches a half-loaded build.
    await waitForAssets(session.page);
    const { dive, active } = await capturePose(session.page, pose, 0.5);
    await session.page.waitForTimeout(COMPILE_WAIT_MS);

    const displaced = Math.hypot(
      dive.x - pose.position[0],
      dive.y - pose.position[1],
      dive.z - pose.position[2],
    );
    const label = String(index).padStart(2, "0");
    const file = path.join(
      OUT_DIR,
      `${prefix}_${SEED}_${QUALITY}_JOURNEY-${spoke}-${label}-${pose.name}_${tag}.png`,
    );
    await session.page.screenshot({ path: file });
    console.info(
      `captured ${path.relative(process.cwd(), file)}\n` +
        `  SHOT_AT=${dive.x.toFixed(1)},${dive.y.toFixed(1)},${dive.z.toFixed(1)},${pose.yaw.toFixed(3)}` +
        ` | attached: ${active.join(", ") || "(none)"}` +
        (displaced > 2 ? ` | DISPLACED ${displaced.toFixed(1)} m — pose invalid` : ""),
    );
  } else if (!perLaunch) {
    // Skipped poses still advance the streamer so the chain stays a swim.
    await capturePose(session.page, pose, REPLAY_SETTLE);
  }
  if (perLaunch) {
    await session.browser.close();
    session = null;
  }
}

if (session) {
  await session.browser.close();
}
