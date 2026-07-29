import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  FogInk,
  instantiate,
  placeGeometry,
  softSprite,
  wingCurtain,
  wingFrame,
  wingPoint,
  type PlacedPart,
} from "./W4FloraKit";

/**
 * Wing 11 — the Open Blue. Vertigo and freedom: the drop-off, and then
 * almost nothing. The hardest brief here is restraint, so this module is
 * short on purpose. It builds exactly four things:
 *
 * - **The lip** (r 36–38): a crisp sandy edge read through a handful of
 *   pale slabs leaning seaward along it — the last solid thing the eye
 *   gets before the water takes over. They hug the flanks; the axis is
 *   left bare, because the bare middle *is* the edge.
 * - **Sparse motes** in the approach water: sixty-four pinpricks, pale and
 *   small, so the clear blue has something to measure itself against.
 * - **Two far curtains** near the end wall (r 48.4 / 48.9), the canyon's
 *   own silhouette idiom — fog-ink re-derived from the live water, deep
 *   blue values, drooping rippled skylines that sit *below* a standing
 *   diver's eye line, so they read as relief on the abyss floor rather
 *   than as walls. The end of the world stays open above them.
 * - **One lone spire** (r 47.6): a single standing stone on the west
 *   flank, the only vertical mark in the whole wing.
 *
 * Everything between r 38 and the far accents is empty on purpose — the
 * serpent patrols that water and the emptiness is the design.
 * `tests/wingsW4Flora.test.ts` asserts the emptiness, not just the pieces:
 * zero flora instances past r 38 except these accents.
 *
 * Five draws, ~2.4k triangles — far under budget, deliberately. Seeds:
 * only `SEEDS.wingOpenBlue` and `^` substreams.
 */

/** The lip's pale sand-stone — the drop-off's edge is lit, not gloomed. */
const LIP_TINT = 0xb7b098;
/** The spire's deep blue-grey: a silhouette, but a colour, never black. */
const SPIRE_TINT = 0x54687a;
/** The curtains' ink: a deep blue step on the live fog, red kept near green. */
const CURTAIN_INK = new Color(0.55, 0.62, 0.9);

/** The mote field's level and tint — sparse is the whole point. */
const MOTE_COLOR = 0xd8e8ff;
const MOTE_COUNT = 64;

/** The lip stones, hand-placed along the edge: (r, lateral). */
const LIP_STONES: readonly [number, number][] = [
  [36.4, -3.1],
  [36.8, 2.7],
  [37.1, -2.5],
  [37.3, 3.4],
  [37.5, -3.4],
  [36.9, 3.0],
  [37.6, -2.9],
];

/** The two far accents, nearest first — planes of deeper water, below the eye. */
const CURTAINS: readonly {
  readonly radius: number;
  readonly halfSpan: number;
  readonly top: number;
  readonly droop: number;
  readonly ripple: number;
  readonly fade: number;
  readonly shadeFoot: number;
  readonly shadeTop: number;
}[] = [
  { radius: 48.4, halfSpan: 0.1, top: -1.4, droop: 1.3, ripple: 0.9, fade: 0.42, shadeFoot: 0.5, shadeTop: 1.0 },
  { radius: 48.9, halfSpan: 0.14, top: -3.6, droop: 1.7, ripple: 1.1, fade: 0.58, shadeFoot: 0.45, shadeTop: 0.95 },
];
const CURTAIN_FOOT = -13;

export function buildOpenBlueFlora(def: WingDef): WingFlora {
  const random = new Random(SEEDS[def.seedKey]);
  const frame = wingFrame(def);
  const seed = SEEDS[def.seedKey];
  const group = new Group();
  group.name = "open-blue-flora";
  const contacts: ContactPatch[] = [];

  // ── The lip: pale slabs leaning seaward along the drop-off's edge. ──
  const slab = slabGeometry({ seed: seed ^ 0x1a2b, radius: 0.85, height: 0.75, amount: 0.15, segments: 10, rings: 10 });
  const lipParts: PlacedPart[] = [];
  const lipColor = new Color();
  for (const [r, lateral] of LIP_STONES) {
    const { x, z } = wingPoint(frame, r, lateral);
    const lean = random.range(0.14, 0.3);
    const yaw = random.range(0, Math.PI * 2);
    const scale = random.range(1.0, 1.35);
    const tone = random.range(0.9, 1.08);
    lipParts.push({
      x,
      y: seabedHeight(x, z) - 0.12,
      z,
      // The lean: a slab tipping toward the drop, like strata letting go.
      rotation: [lean, yaw, lean * random.range(0.2, 0.5)],
      scale: [scale, scale * random.range(0.75, 1.0), scale * random.range(0.55, 0.75)],
      color: lipColor.setHex(LIP_TINT).multiplyScalar(tone).clone(),
    });
    contacts.push({ x, z, radius: 1.0, strength: 0.3 });
  }
  const lipMaterial = createToonMaterial({ vertexColors: true });
  group.add(instantiate(slab, lipMaterial, lipParts, "w4-openblue-lip"));

  // ── The motes: sixty-four pinpricks in the approach water, no more. ──
  const motePositions = new Float32Array(MOTE_COUNT * 3);
  for (let i = 0; i < MOTE_COUNT; i++) {
    const r = random.range(30, 39.5);
    const half = wedgeHalfAt(def, r) * 0.8;
    const theta = def.azimuth + random.signed(half);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    motePositions[i * 3] = x;
    motePositions[i * 3 + 1] = seabedHeight(x, z) + random.range(0.5, 5.0);
    motePositions[i * 3 + 2] = z;
  }
  const moteGeometry = new BufferGeometry();
  moteGeometry.setAttribute("position", new BufferAttribute(motePositions, 3));
  moteGeometry.computeBoundingSphere();
  const moteMaterial = new PointsMaterial({
    color: MOTE_COLOR,
    size: 0.06,
    map: softSprite(),
    transparent: true,
    opacity: 0.42,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
  });
  const motes = new Points(moteGeometry, moteMaterial);
  motes.name = "w4-openblue-motes";
  group.add(motes);

  // ── The far curtains: two low planes of deeper water near the end wall. ──
  const inkEntries: { material: MeshBasicMaterial; fade: number }[] = [];
  const curtainMeshes: Mesh[] = [];
  for (const [index, curtain] of CURTAINS.entries()) {
    const material = new MeshBasicMaterial({
      color: 0x2c4a66,
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
    });
    inkEntries.push({ material, fade: curtain.fade });
    const geometry = wingCurtain({
      azimuth: def.azimuth,
      radius: curtain.radius,
      halfSpan: curtain.halfSpan,
      foot: CURTAIN_FOOT,
      top: curtain.top,
      droop: curtain.droop,
      ripple: curtain.ripple,
      seed: seed ^ (0xc101 + index * 131),
      shadeFoot: curtain.shadeFoot,
      shadeTop: curtain.shadeTop,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `w4-openblue-curtain-${index}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    curtainMeshes.push(mesh);
    group.add(mesh);
  }
  const ink = new FogInk(inkEntries, CURTAIN_INK);
  for (const mesh of curtainMeshes) {
    ink.hook(mesh);
  }

  // ── The lone spire: one vertical on the west flank, past the patrol. ──
  const spireGeometry = stackGeometry(
    [
      { radius: 1.5, rise: 0, stretch: 3.0, lean: 0 },
      { radius: 1.0, rise: 3.4, stretch: 2.4, lean: 0.5 },
      { radius: 0.62, rise: 6.2, stretch: 2.2, lean: 0.9 },
    ],
    { seed: seed ^ 0x5e11, amount: 0.13, segments: 14, rings: 18 },
  );
  const spireAt = wingPoint(frame, 47.6, -4.2);
  placeGeometry(
    spireGeometry,
    Math.atan2(-frame.axisZ, frame.axisX),
    spireAt.x,
    seabedHeight(spireAt.x, spireAt.z),
    spireAt.z,
  );
  spireGeometry.computeBoundingSphere();
  const spireMaterial = createToonMaterial({ color: SPIRE_TINT, vertexColors: true });
  const spire = new Mesh(spireGeometry, spireMaterial);
  spire.name = "w4-openblue-spire";
  spire.castShadow = false;
  spire.receiveShadow = false;
  group.add(spire);
  contacts.push({ x: spireAt.x, z: spireAt.z, radius: 2.4, strength: 0.5 });

  // The test asserts what this module refuses to build: the spire and the
  // curtains are the only marks past the drop-off's lip.
  return { group, contacts };
}
