/**
 * Connective-3 capture harness: the two Batch 3 wings (interior pose from
 * the wave-8 canon + a doorway pose), the five traveller routes (two
 * authored poses each, framing most of a loop so the seeded timetable
 * cannot hide the shoal), and the verdant pass verification pair (both
 * regions forced, per MASTER R4 / connective §4.4).
 *
 *   node scripts/conn3-shots.mjs <change-tag> [wings|routes|pass|all]
 *
 * Requires a dev server (SHOT_URL, default http://localhost:5205 — this
 * lane's port). SHOT_PER_LAUNCH=1 relaunches Chromium per pose (the
 * Calamity fill's finding for loaded boxes).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { blockAssets, noAssets, waitForAssets } from "./wait-for-assets.mjs";

const BASE_URL = process.env.SHOT_URL ?? "http://localhost:5205";
const OUT_DIR = path.resolve("visual-qa");
const SEED = "seed1";
const QUALITY = "hi";
const VIEWPORT = { width: 1600, height: 900 };
// The box runs several sibling worktrees' capture rigs (load avg ~25);
// page boot has been measured past 300 s — the conn1 ledger's hazard.
const NAV_TIMEOUT_MS = 480_000;
const perLaunch = process.env.SHOT_PER_LAUNCH === "1";

const tag = process.argv[2];
const set = process.argv[3] ?? "all";
if (!tag) {
  console.error("usage: node scripts/conn3-shots.mjs <change-tag> [wings|routes|pass|all]");
  process.exit(1);
}

/** Look along (dx, dz): DiveController forward is (-sin yaw, 0, -cos yaw). */
function yawToward(dx, dz) {
  return Math.atan2(-dx, -dz);
}

/** The two wings' azimuths (FROZEN in the defs). */
const WINGS = {
  "sandfall-dunes": 6.39,
  "ruins-terrace": 4.59,
};

function polar(azimuth, r, lateral = 0) {
  const x = Math.cos(azimuth) * r - Math.sin(azimuth) * lateral;
  const z = Math.sin(azimuth) * r + Math.cos(azimuth) * lateral;
  return [x, z];
}

function wingPoses() {
  const poses = [];
  for (const [id, azimuth] of Object.entries(WINGS)) {
    // The wave-8 canonical interior pose (scripts/wave8-wing-shots.mjs).
    const y = id === "sandfall-dunes" ? -1.7 : -2.2;
    const [ix, iz] = polar(azimuth, 36.5);
    poses.push({
      name: `WING-${id}`,
      position: [ix, y, iz],
      yaw: yawToward(Math.cos(azimuth), Math.sin(azimuth)),
      pitch: -0.08,
      settle: 4,
    });
    // The doorway pose: standing over the uplift bed, reading the door.
    // r2: the ruins camera slides to the west flank — at (42.2, +1.4) it
    // stood against the half-buried round doorway's torus.
    // r3 tried a metre further west and put the colonnade in the lens;
    // the r2 stand is the canonical door pose.
    const doorSpot = id === "ruins-terrace" ? [40.5, -2.6] : [42.2, 1.4];
    const [dx, dz] = polar(azimuth, doorSpot[0], doorSpot[1]);
    poses.push({
      name: `WING-${id}-door`,
      position: [dx, id === "sandfall-dunes" ? -2.6 : -3.0, dz],
      yaw: yawToward(Math.cos(azimuth), Math.sin(azimuth)) + (id === "ruins-terrace" ? 0.06 : 0.03),
      pitch: -0.1,
      settle: 4,
    });
  }
  return poses;
}

const ROUTES = {
  verdant: 1.35,
  golden: 6.39,
  pale: 3.87,
  smoking: 2.79,
  calamity: 4.59,
};

function routePoses() {
  const poses = [];
  for (const [id, azimuth] of Object.entries(ROUTES)) {
    // r2: beside the rim loop rather than 13 m behind it — at r 18.5 the
    // fish were sub-pixel (the verdant r1 miss). The camera stands just
    // off the outbound lane, watching the gate the commute threads.
    const [bx, bz] = polar(azimuth, 24.0, -4.6);
    const [gbx, gbz] = polar(azimuth, 31.2);
    poses.push({
      name: `ROUTE-${id}-bowl`,
      // Raised to hold the whole rim loop AND see over the sill deep
      // into the corridor — the golden r5 lesson: a file that cannot
      // leave the frame needs no phase luck.
      position: [bx, 6.0, bz],
      yaw: yawToward(gbx - bx, gbz - bz),
      pitch: -0.19,
      settle: 6,
      // r4: the traveller clock is pinned per pose (Game.pinTravellerPhase
      // — the QA door added after calamity's 16-fish file spent both r2
      // and r3 hidden in the bowl loop). Head just past the gate notch,
      // file trailing through the rim loop.
      pin: { id, phase: 0.16 },
    });
    // r3: from INSIDE the swim corridor beside the doorway, looking back
    // down the lane toward the gate — the corridor is the one lane every
    // wing law keeps open, and the route's out-and-back legs pass either
    // side of the camera, so most of the loop is in frame.
    // r4: smoking raised — vent-springs' corridor floor is the deepest
    // (-7.3 m at the stand) under a +1.1 m gate sill, and the r3 camera
    // 2.7 m off the floor sat behind the r38-42 rise reading an 8-metre
    // wall. Pitch eased down to hold the corridor floor from the higher
    // stand.
    const floorY = { verdant: -2.6, golden: -2.4, pale: -1.6, smoking: -1.6, calamity: -3.8 }[id];
    const [wx, wz] = polar(azimuth, 44.2, -1.2);
    const [gx, gz] = polar(azimuth, 30.5);
    poses.push({
      name: `ROUTE-${id}-wing`,
      position: [wx, floorY, wz],
      yaw: yawToward(gx - wx, gz - wz),
      pitch: id === "smoking" ? -0.12 : -0.04,
      settle: 6,
      // Head mid-corridor on the out shoulder (s≈0.36 of the loop),
      // trailing back toward the gate — in-frame for every span.
      pin: { id, phase: 0.36 },
    });
  }
  return poses;
}

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
  return { browser, page };
}

await mkdir(OUT_DIR, { recursive: true });
const prefix = stamp();

let { browser, page } = await openPage();

async function freshPage() {
  for (let attempt = 0; ; attempt++) {
    try {
      if (perLaunch || attempt > 0) {
        await browser.close();
        ({ browser, page } = await openPage());
      }
      await page.goto(`${BASE_URL}/?reset=1`, { waitUntil: "load" });
      await page.waitForFunction(() => "__reef" in window);
      await waitForAssets(page);
      return;
    } catch (error) {
      if (attempt >= 2) {
        throw error;
      }
      console.warn(`  boot attempt ${attempt + 1} failed (${error.name}); relaunching`);
    }
  }
}

async function shoot(name, pose) {
  // The pin and the capture share one evaluate, so the only clock drift
  // left between them is the pose's own settle (≤ 6 s ≈ 2% of a period).
  await page.evaluate((p) => {
    if (p.pin) {
      window.__reef.pinTravellerPhase(p.pin.id, p.pin.phase);
    }
    window.__reef.capture(p);
  }, pose);
  await page.waitForTimeout(900);
  const file = path.join(OUT_DIR, `${prefix}_${SEED}_${QUALITY}_${name}_${tag}.png`);
  await page.screenshot({ path: file });
  console.info(`captured ${path.relative(process.cwd(), file)}`);
}

if (set === "wings" || set === "all") {
  for (const pose of wingPoses()) {
    await freshPage();
    await shoot(pose.name, pose);
  }
}

if (set === "routes" || set === "all") {
  for (const pose of routePoses()) {
    await freshPage();
    await shoot(pose.name, pose);
  }
}

if (set === "pass" || set === "all") {
  // The Emerald Stair pass, verified with BOTH verdant regions attached
  // (the ring-over-pass gate must hold from either side — MASTER R4).
  const passPoses = [
    // From the Great Kelp Sea side: the falling-edge country looking up
    // the pass corridor (verdant-1's own falling-edge pose numbers live
    // in its def; this stands on the corridor spine at the rim).
    { region: "verdant-line-1", poseName: "falling-edge" },
    // From the Emerald Terraces side: the authored pass-threshold pose.
    { region: "verdant-line-2", poseName: "pass-threshold" },
  ];
  for (const spec of passPoses) {
    await freshPage();
    await page.evaluate(() => {
      window.__reef.forceRegion("verdant-line-1");
      window.__reef.forceRegion("verdant-line-2");
    });
    await waitForAssets(page);
    const pose = await page.evaluate(
      ([slot, name]) => {
        const def = window.__reefRegions.defs.find((candidate) => candidate.slotId === slot);
        if (!def) {
          throw new Error(`no region def for ${slot}`);
        }
        const found = def.capturePoses.find((candidate) => candidate.name === name);
        if (!found) {
          throw new Error(`no pose ${name} in ${slot}`);
        }
        return found;
      },
      [spec.region, spec.poseName],
    );
    await shoot(`PASS-${spec.region}-${spec.poseName}`, {
      position: [...pose.position],
      yaw: pose.yaw,
      pitch: pose.pitch,
      settle: pose.settle,
    });
  }
}

await browser.close();
