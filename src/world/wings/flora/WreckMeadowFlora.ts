import { Color, Group, InstancedMesh, Mesh, Object3D } from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import type { WingDef, WingFlora } from "../WingTypes";
import { buildBladeMeadow } from "./WreckMeadowBlades";
import { keelGeometry, ribArcGeometry, timberGeometry } from "./WreckMeadowRibs";

/**
 * Wing 3 — the Wreck Meadow. Melancholy and curiosity: the ribs of an old
 * hull half-swallowed by a seagrass meadow.
 *
 * The composition is one story told in three registers. The keel line runs
 * down the wing's axis with two bites taken out of it — the sea has already
 * had most of this ship. The rib cage stands along it, hoops and snapped
 * stubs listing off vertical like a fence after a storm, two of them
 * fallen outright beside the line. And the meadow does the melancholy:
 * muted sage stands riding the wing floor right up to the timber, because
 * nothing here is a threat — everything here is a story already over, and
 * the grass has had decades to say so.
 *
 * Six draw calls, all scenery: three rib instanced meshes (one geometry
 * per silhouette), the keel as a single merged mesh, one instanced plank
 * field, one instanced meadow. The wood shares one toon material and one
 * vertex-baked rust ramp; per-instance colour is only a value-and-warmth
 * drift around the bake, so no two ribs weather alike and none goes black
 * (the value key's rule: rust is red above green, and its darkest is a
 * colour).
 */

/** Where the keel still lies, as radial runs along the axis. */
const KEEL_RUNS = [
  { r0: 36.4, r1: 39.2 },
  { r0: 39.8, r1: 42.6 },
  { r0: 43.4, r1: 45.8 },
] as const;

/** Rib stations: from the first keel run to the last, ~0.8 m apart. */
const RIB_FROM = 36.9;
const RIB_TO = 45.3;
const RIB_STEP = 0.82;

/** Odds a station is a hoop; the rest split between the two stub shapes. */
const HOOP_ODDS = 0.42;
const STUB_LOW_ODDS = 0.73;
/** Odds a rib has fallen against the sand beside the line. */
const FALLEN_ODDS = 0.1;

/** The meadow's three drifts: sage, olive, grey-teal — one muted value band. */
const MEADOW_PALETTE = {
  families: [
    [0x6e9a74, 0x88ab72, 0x54816a],
    [0x7e9a5c, 0x95ae6a, 0x66814e],
    [0x62a08a, 0x7cb496, 0x4f8674],
  ],
} as const;

export function buildWreckMeadowFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "wreck-meadow-flora";
  const random = new Random(SEEDS.wingWreckMeadow);
  const contacts: ContactPatch[] = [];

  const axisX = Math.cos(def.azimuth);
  const axisZ = Math.sin(def.azimuth);
  const perpX = -axisZ;
  const perpZ = axisX;

  // One wood material for every timber in the wing: the vertex bake owns
  // the rust ramp, the instance colours are only weathering drift.
  const wood = createToonMaterial({ vertexColors: true });

  // ── The rib cage. ──
  // Three silhouettes: the hoop that still stands across the keel, and the
  // same frame snapped low or high. One geometry each; everything else is
  // per-instance.
  const hoopGeometry = ribArcGeometry({
    seed: SEEDS.wingWreckMeadow ^ 0x1b05,
    phi: 1.95,
    tipTheta: 1.95,
    tube: 0.055,
  });
  const stubLowGeometry = ribArcGeometry({
    seed: SEEDS.wingWreckMeadow ^ 0x2c06,
    phi: 1.95,
    tipTheta: 0.62,
    tube: 0.058,
  });
  const stubHighGeometry = ribArcGeometry({
    seed: SEEDS.wingWreckMeadow ^ 0x3d07,
    phi: 1.95,
    tipTheta: 1.18,
    tube: 0.055,
  });

  const stations = Math.floor((RIB_TO - RIB_FROM) / RIB_STEP) + 1;
  const kinds = [hoopGeometry, stubLowGeometry, stubHighGeometry] as const;
  const ribs = kinds.map(
    (geometry) => new InstancedMesh(geometry, wood, stations),
  );
  for (const mesh of ribs) {
    mesh.name = "wreck-ribs";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const dummy = new Object3D();
  const color = new Color();
  const counts = [0, 0, 0];

  // Two stations are chosen to have fallen outright — drawn before the
  // loop so every station's own draws land exactly as they would without
  // the guarantee, and the wreck always has its downed ribs.
  const fallA = Math.floor(random.next() * stations);
  const fallB = (fallA + 1 + Math.floor(random.next() * (stations - 2))) % stations;

  for (let station = 0; station < stations; station++) {
    const r = RIB_FROM + station * RIB_STEP;
    const kindDraw = random.next();
    const kind = kindDraw < HOOP_ODDS ? 0 : kindDraw < STUB_LOW_ODDS ? 1 : 2;
    const fallen = random.next() < FALLEN_ODDS || station === fallA || station === fallB;
    const scale = random.range(1.55, 2.35);
    const yawJitter = random.signed(fallen ? 0.55 : 0.12);
    const list = random.signed(fallen ? 0.2 : 0.16);
    // Both offsets drawn whether or not the rib falls: a fallen station
    // must not shift the stream for every station after it.
    const lateralBase = random.signed(0.18);
    const lateralFallen = random.signed(1.4);
    const lateral = lateralBase + (fallen ? lateralFallen : 0);
    const warm = random.range(0.9, 1.08);
    const mid = random.range(0.85, 1.0);
    const cool = random.range(0.78, 0.95);
    const value = random.range(0.78, 1.12);

    const x = axisX * r + perpX * lateral;
    const z = axisZ * r + perpZ * lateral;
    dummy.position.set(x, seabedHeight(x, z) - (fallen ? 0.18 : 0), z);
    // A standing rib's plane crosses the keel; a fallen one lies alongside.
    dummy.rotation.set(list * 0.5, Math.PI / 2 - def.azimuth + yawJitter, list);
    if (fallen) {
      dummy.rotation.z += random.range(1.05, 1.3);
      dummy.scale.setScalar(scale * 0.72);
      contacts.push({ x, z, radius: scale * 1.1, strength: 0.4 });
    } else {
      dummy.scale.setScalar(scale);
    }
    dummy.updateMatrix();

    const mesh = ribs[kind]!;
    const index = counts[kind]!;
    mesh.setMatrixAt(index, dummy.matrix);
    color.setRGB(warm, mid, cool).multiplyScalar(value);
    mesh.setColorAt(index, color);
    counts[kind] = index + 1;
  }

  // Park the instances a station did not take.
  dummy.position.set(0, -200, 0);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (const [kind, mesh] of ribs.entries()) {
    for (let i = counts[kind]!; i < stations; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }

  // ── The keel line. ──
  const keel = new Mesh(
    keelGeometry(KEEL_RUNS, def.azimuth, SEEDS.wingWreckMeadow ^ 0x1e07),
    wood,
  );
  keel.name = "wreck-keel";
  keel.castShadow = false;
  keel.receiveShadow = true;
  keel.geometry.computeBoundingSphere();
  group.add(keel);
  for (const run of KEEL_RUNS) {
    const mid = (run.r0 + run.r1) / 2;
    contacts.push({
      x: axisX * mid,
      z: axisZ * mid,
      radius: 2.5,
      strength: 0.45,
    });
  }

  // ── The scattered timbers. ──
  // Twenty planks the sea spread over the meadow floor, plus two at the
  // gate's flanks so the story starts in the doorway. One geometry, one
  // instanced mesh, the wood material again.
  const TIMBER_COUNT = 22;
  const timbers = new InstancedMesh(
    timberGeometry(SEEDS.wingWreckMeadow ^ 0x4f11),
    wood,
    TIMBER_COUNT,
  );
  timbers.name = "wreck-timbers";
  timbers.castShadow = false;
  timbers.receiveShadow = true;
  let timberIndex = 0;

  const layTimber = (r: number, lateral: number): void => {
    const x = axisX * r + perpX * lateral;
    const z = axisZ * r + perpZ * lateral;
    dummy.position.set(x, seabedHeight(x, z) - random.range(0.03, 0.1), z);
    dummy.rotation.set(random.signed(0.08), random.range(0, Math.PI * 2), random.signed(0.06));
    dummy.scale.set(random.range(0.9, 2.3), 1, random.range(0.8, 1.3));
    dummy.updateMatrix();
    timbers.setMatrixAt(timberIndex, dummy.matrix);
    color.setRGB(random.range(0.9, 1.06), random.range(0.86, 1.0), random.range(0.8, 0.95));
    color.multiplyScalar(random.range(0.8, 1.1));
    timbers.setColorAt(timberIndex, color);
    timberIndex++;
  };

  for (let plank = 0; plank < 18; plank++) {
    const r = random.range(35, 46.6);
    const lateral = random.signed(r * def.wedge.floorHalf * 0.9);
    layTimber(r, lateral);
  }
  // The gate pair: off the doorway's centre line, which stays swimmable.
  for (const side of [-1, 1]) {
    layTimber(random.range(32.2, 33.4), side * random.range(2.0, 2.5));
  }
  dummy.position.set(0, -200, 0);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = timberIndex; i < TIMBER_COUNT; i++) {
    timbers.setMatrixAt(i, dummy.matrix);
  }
  timbers.instanceMatrix.needsUpdate = true;
  if (timbers.instanceColor) {
    timbers.instanceColor.needsUpdate = true;
  }
  timbers.computeBoundingSphere();
  group.add(timbers);

  // ── The meadow that swallowed the wreck. ──
  const meadow = buildBladeMeadow({
    def,
    seed: SEEDS.wingWreckMeadow ^ 0x6d31,
    patches: 12,
    bladesPerPatch: 42,
    patchRadius: 2.6,
    radiusFrom: 33.6,
    radiusTo: 46.8,
    palette: MEADOW_PALETTE,
    bladeHeight: 1.15,
    bladeWidth: 0.24,
    heightRange: [0.6, 1.35],
    gateMargin: 1.7,
    avoid: (x, z) => {
      // Grass hugs the keel without spearing through the timber.
      const lateral = x * perpX + z * perpZ;
      if (Math.abs(lateral) >= 0.55) {
        return false;
      }
      const along = x * axisX + z * axisZ;
      return KEEL_RUNS.some((run) => along >= run.r0 - 0.3 && along <= run.r1 + 0.3);
    },
  });
  group.add(meadow.mesh);

  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      meadow.update(dt, reducedMotion);
    },
  };
}
