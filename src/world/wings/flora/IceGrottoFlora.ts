import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector2,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { buildGroundLitter } from "../../regions/kit/GroundLitter";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { angleBetween, wedgeHalfAt, wingCeiling } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import { mountGateVeil } from "./GateVeilMount";
import { TIERB_GROUP_NAME } from "./TierBUplift";

/**
 * The Ice Grotto's flora (wave 8, `SEEDS.wingIceGrotto` + substreams):
 * hushed crystalline calm under the lowest roof in the game.
 *
 * Five draw calls, all of them cold and none of them loud:
 *
 * - **Crystal spires** — tall faceted hexagonal lathes in clusters flanking
 *   the corridor, pale blue-white over a cold violet shade band (red held
 *   above green, per the value key). The facets are baked into the geometry
 *   (`toNonIndexed` + face normals), so the material stays the one smooth
 *   toon ramp everything else wears — the chisel is in the silhouette, not
 *   in a second shading model.
 * - **Shards** — the same crystal family at foot size: the gate dressing on
 *   the jambs (r 31–34, scenery only, the doorway itself untouched) and a
 *   scatter at the clusters' feet so a spire reads as grown, not planted.
 * - **Icicles** — the spire geometry flipped and hung from the grotto's low
 *   ceiling, embedded a hand's breadth into the roof so they read as grown
 *   through it from above. Slender, slow, and off the corridor like
 *   everything else here.
 * - **Frost rosettes** — the seaweed rosette idiom pressed low and paled,
 *   nestled at the wall feet either side of the corridor.
 * - **Glitter** — a sparse cloud of tiny slow motes, the only thing that
 *   moves in the whole wing, and barely: a twinkle on a two-to-eight-second
 *   cycle, becalmed further under reduced motion.
 *
 * The frost moray's den sits on the wing's axis at r 40–43 (W6's package),
 * so nothing here — not one vertex — comes within 0.06 rad of the axis for
 * r 30–46, and the gate corridor keeps a stricter 0.075 rad. That is the
 * canyon flora's corridor fence restated for the wedge, and
 * `tests/wingsW5Flora.test.ts` sweeps every vertex against it.
 */

/**
 * The corridor law: the den approach runs down the axis, so flora origins
 * stay this far (plus their footprint) off it for r 30–46, and further
 * still across the gate band where the doorway must read open.
 */
const CORRIDOR_ACROSS = 0.064;
const GATE_R_TO = 34.5;
const GATE_ACROSS = 0.077;

/** How far a cluster's spires spread from its centre, in metres. */
const CLUSTER_SPREAD = 0.55;

/** The spire palette: pale blue-whites. The violet lives in the bake. */
const SPIRE_TONES = [0xd7e4f2, 0xc9dcef, 0xe2ecf6] as const;
/** The rosettes' frost tones, pressed under the spires' value. */
const FROST_TONES = [0xc3d6e8, 0xd2e1ef, 0xb8cde2] as const;

/**
 * The crystal's two ends: a cold violet at the buried base (red above green,
 * the shade band a painter mixes) climbing to a pale ice tip. It multiplies
 * the instance tints, so the gradient is the same for every crystal and the
 * population variety rides the per-instance colour the way the seaweed
 * field's does.
 */
const CRYSTAL_BASE = new Color(0.52, 0.5, 0.78);
const CRYSTAL_TIP = new Color(0.9, 0.95, 1.0);

/**
 * The authored spire silhouette, unit height: a buried foot, the widest
 * point low, a long gentle taper to the point. Lathed at six segments and
 * faceted, it is the one shape this wing draws at three sizes — hero
 * spires, shards, and (flipped) icicles.
 */
const SPIRE_PROFILE: readonly (readonly [number, number])[] = [
  [0, -0.25],
  [0.3, -0.25],
  [0.38, 0.06],
  [0.42, 0.22],
  [0.36, 0.45],
  [0.24, 0.68],
  [0.12, 0.86],
  [0, 1],
];

/** The shard's silhouette: the same crystal, squat and wide at the foot. */
const SHARD_PROFILE: readonly (readonly [number, number])[] = [
  [0, -0.2],
  [0.34, -0.2],
  [0.4, 0.05],
  [0.36, 0.3],
  [0.26, 0.55],
  [0, 0.72],
];

/**
 * The band of across-angles a flora origin may take at radius `r`, given
 * its footprint: corridor fence on the axis side (stricter over the gate
 * band), the wedge wall minus the footprint on the other. When the band is
 * empty the caller still consumes its draws and simply places nothing —
 * the kelp test's rule, so a clearance tune can never re-roll a sibling.
 */
function acrossWindow(def: WingDef, r: number, footprint: number): readonly [number, number] {
  const margin = (footprint / r) * 1.05 + 0.002;
  let min = CORRIDOR_ACROSS + margin;
  if (r < GATE_R_TO) {
    min = Math.max(min, GATE_ACROSS + margin);
  }
  const max = wedgeHalfAt(def, r) - margin - 0.004;
  return [min, max];
}

/** A point in the wedge, from its radial and across-angle coordinates. */
function wedgePoint(
  def: WingDef,
  r: number,
  across: number,
): { readonly x: number; readonly z: number } {
  const theta = def.azimuth + across;
  return { x: Math.cos(theta) * r, z: Math.sin(theta) * r };
}

/**
 * A faceted crystal lathe with the violet-to-ice gradient baked in. The
 * facets come from exploding the lathe to face normals — the smooth toon
 * ramp then lights each face as a flat, which is exactly what cut crystal
 * does under a stepped light.
 */
function crystalGeometry(profile: readonly (readonly [number, number])[]): BufferGeometry {
  const lathe = new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    6,
  );
  const geometry = lathe.toNonIndexed();
  lathe.dispose();
  geometry.computeVertexNormals();

  const position = geometry.attributes.position!;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const extent = Math.max(1e-3, maxY - minY);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.pow((position.getY(i) - minY) / extent, 0.75);
    shade.copy(CRYSTAL_BASE).lerp(CRYSTAL_TIP, t);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

interface CrystalSpot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly tiltX: number;
  readonly yaw: number;
  readonly tiltZ: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly tone: number;
  readonly fade: number;
}

/** Fills one InstancedMesh from drawn spots; the crystals' shared ritual. */
function instancedCrystals(
  name: string,
  geometry: BufferGeometry,
  material: Parameters<typeof createToonMaterial>[0],
  spots: readonly CrystalSpot[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, createToonMaterial(material), spots.length);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const color = new Color();
  for (const [i, spot] of spots.entries()) {
    dummy.position.set(spot.x, spot.y, spot.z);
    dummy.rotation.set(spot.tiltX, spot.yaw, spot.tiltZ);
    dummy.scale.set(spot.sx, spot.sy, spot.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHex(spot.tone).multiplyScalar(spot.fade);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

/** The crystal material: a breath of cold self-light, far under the bloom. */
const CRYSTAL_MATERIAL_OPTIONS = {
  vertexColors: true,
  emissive: 0x8fa8d8,
  emissiveIntensity: 0.1,
} as const;

export function buildIceGrottoFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "ice-grotto-flora";
  const contacts: ContactPatch[] = [];

  const spires = buildSpires(def, contacts);
  group.add(spires);
  group.add(buildShards(def, contacts));
  group.add(buildIcicles(def));
  group.add(buildRosettes(def));
  const glitter = buildGlitter(def);
  group.add(glitter.points);

  // ── Batch 4: the Tier B uplift (MASTER §4 closure, R2 ≤ +6 / ≤ 20k) ──
  // The T1 statement in the grotto's own hush: a hoarfrost splinter field
  // — fine pale-violet shards dusting the shelf between the spire
  // clusters, the crystal country's own ground state. The corridor law
  // (0.06 rad through r 30–46, stricter over the gate) is kept with the
  // shards' own footprint on top, vertex-proof against the W5 collector.
  // Fresh `^` substream, kit-private Random, appended after every wave-8
  // draw.
  const uplift = new Group();
  uplift.name = TIERB_GROUP_NAME;
  const hoarfrost = buildGroundLitter({
    seed: (SEEDS.wingIceGrotto ^ 0xb408) >>> 0,
    palette: { base: 0xcdd4ec, shade: 0x8a86ac },
    area: { center: [Math.cos(def.azimuth) * 41, Math.sin(def.azimuth) * 41], radius: 7 },
    gate: (x, z) => {
      const r = Math.hypot(x, z);
      if (r < 35.2 || r > 47) {
        return 0;
      }
      const away = angleBetween(Math.atan2(z, x), def.azimuth);
      if (away < CORRIDOR_ACROSS + 0.012 + 0.3 / r) {
        return 0;
      }
      return away > wedgeHalfAt(def, r) - 0.02 ? 0 : 1;
    },
    ground: seabedHeight,
    count: 380,
    shapeSet: "shard",
    size: [0.04, 0.13],
    grade: 0.35,
  });
  uplift.add(hoarfrost.group);
  group.add(uplift);

  // The doorway: a cool violet-white veil, a frost-pale column and a slow
  // sparkle of frost motes — the crystalline hush promised from the bowl.
  const veil = mountGateVeil(def, {
    doorR: 32,
    width: 3.6,
    height: 3.4,
    sillLift: -0.9,
    palette: [0x363450, 0x504e6e, 0x74738e],
    column: { tint: 0xe8ecfa, opacity: 0.07 },
    particulate: { tint: 0xe0e8fa, count: 45 },
  });
  group.add(veil.group);

  let time = 0;
  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      // The one moving thing in the grotto, and it barely moves: the hush
      // is the point. Becalmed to a quarter under reduced motion.
      time += dt * (reducedMotion ? 0.25 : 1);
      glitter.update(time);
      veil.update(dt, reducedMotion);
    },
  };
}

/**
 * The hero spires: six clusters standing off the corridor like the canyon's
 * ghost kelp does — r ≥ 38, where the wedge has widened enough to hold a
 * cluster's footprint outside the den's approach.
 */
function buildSpires(def: WingDef, contacts: ContactPatch[]): InstancedMesh {
  const random = new Random(SEEDS.wingIceGrotto);
  const spots: CrystalSpot[] = [];

  for (let c = 0; c < 6; c++) {
    // Fixed stations with a jitter: guaranteed window, one draw.
    const r = 38 + c * 1.9 + random.signed(0.8);
    const side = c % 2 === 0 ? -1 : 1;
    const acrossT = random.next();
    const count = 3 + Math.floor(random.next() * 3);
    const [minA, maxA] = acrossWindow(def, r, CLUSTER_SPREAD + 0.5);
    if (minA >= maxA) {
      // The draws above are spent either way, so a future wedge change
      // degrades to silence, never a reroll.
      continue;
    }
    const across = side * (minA + acrossT * (maxA - minA));
    const centre = wedgePoint(def, r, across);
    contacts.push({ x: centre.x, z: centre.z, radius: 1.7, strength: 0.4 });

    for (let s = 0; s < count; s++) {
      const angle = random.range(0, Math.PI * 2);
      const dist = 0.15 + CLUSTER_SPREAD * Math.sqrt(random.next());
      const x = centre.x + Math.cos(angle) * dist;
      const z = centre.z + Math.sin(angle) * dist;
      spots.push({
        x,
        y: seabedHeight(x, z),
        z,
        tiltX: random.signed(0.05),
        yaw: random.range(0, Math.PI * 2),
        tiltZ: random.signed(0.05),
        sx: random.range(0.75, 1.2),
        sy: random.range(2.4, 4.8),
        sz: random.range(0.75, 1.2),
        tone: SPIRE_TONES[Math.floor(random.next() * SPIRE_TONES.length)] ?? SPIRE_TONES[0],
        fade: random.range(0.9, 1.08),
      });
    }
  }

  return instancedCrystals("ice-spires", crystalGeometry(SPIRE_PROFILE), CRYSTAL_MATERIAL_OPTIONS, spots);
}

/**
 * The shards: gate dressing on the jambs at r 31–34 — four groups against
 * the walls, the doorway's centre lane untouched — plus a scatter at the
 * spire clusters' feet. Scenery only, small enough to carry no shadow.
 */
function buildShards(def: WingDef, contacts: ContactPatch[]): InstancedMesh {
  const random = new Random(SEEDS.wingIceGrotto ^ 0x1ce5);
  const spots: CrystalSpot[] = [];

  // The gate jambs: alternating sides, tucked to the wall at r 33–34 where
  // the wedge has widened enough to hold them beside a fully open lane.
  for (let g = 0; g < 4; g++) {
    const r = 33.0 + g * 0.3 + random.signed(0.1);
    const side = g % 2 === 0 ? -1 : 1;
    const acrossT = random.next();
    const count = 2 + Math.floor(random.next() * 2);
    const [minA, maxA] = acrossWindow(def, r, 0.5);
    if (minA >= maxA) {
      continue;
    }
    const across = side * (minA + acrossT * (maxA - minA));
    const centre = wedgePoint(def, r, across);
    contacts.push({ x: centre.x, z: centre.z, radius: 0.8, strength: 0.35 });
    for (let s = 0; s < count; s++) {
      const angle = random.range(0, Math.PI * 2);
      const dist = 0.2 * Math.sqrt(random.next());
      const x = centre.x + Math.cos(angle) * dist;
      const z = centre.z + Math.sin(angle) * dist;
      spots.push({
        x,
        y: seabedHeight(x, z),
        z,
        tiltX: random.signed(0.12),
        yaw: random.range(0, Math.PI * 2),
        tiltZ: random.signed(0.12),
        sx: random.range(0.45, 0.7),
        sy: random.range(0.7, 1.4),
        sz: random.range(0.45, 0.7),
        tone: SPIRE_TONES[Math.floor(random.next() * SPIRE_TONES.length)] ?? SPIRE_TONES[0],
        fade: random.range(0.88, 1.05),
      });
    }
  }

  // The clusters' feet: broken crystal where the spires grow, drawn from
  // the same stream (after the gate, so the doorway is bit-stable).
  for (let c = 0; c < 6; c++) {
    const r = 38 + c * 1.9 + random.signed(1.1);
    const side = c % 2 === 0 ? 1 : -1;
    const acrossT = random.next();
    const [minA, maxA] = acrossWindow(def, r, 0.6);
    if (minA >= maxA) {
      continue;
    }
    const across = side * (minA + acrossT * (maxA - minA));
    const centre = wedgePoint(def, r, across);
    const x = centre.x + random.signed(0.25);
    const z = centre.z + random.signed(0.25);
    spots.push({
      x,
      y: seabedHeight(x, z),
      z,
      tiltX: random.signed(0.2),
      yaw: random.range(0, Math.PI * 2),
      tiltZ: random.signed(0.2),
      sx: random.range(0.45, 0.8),
      sy: random.range(0.6, 1.3),
      sz: random.range(0.45, 0.8),
      tone: SPIRE_TONES[Math.floor(random.next() * SPIRE_TONES.length)] ?? SPIRE_TONES[0],
      fade: random.range(0.85, 1.02),
    });
  }

  return instancedCrystals("ice-shards", crystalGeometry(SHARD_PROFILE), CRYSTAL_MATERIAL_OPTIONS, spots);
}

/**
 * The icicles: the spire crystal turned point-down and hung from the low
 * roof, embedded into it so the grotto reads as grown from above. They
 * cluster loosely over the corridor's flanks — never over the approach
 * itself — and their tips stay well above a diver's head.
 */
function buildIcicles(def: WingDef): InstancedMesh {
  const random = new Random(SEEDS.wingIceGrotto ^ 0x1c1c);
  const spots: CrystalSpot[] = [];

  for (let i = 0; i < 34; i++) {
    const r = 36 + i * 0.36 + random.signed(0.3);
    const side = i % 2 === 0 ? -1 : 1;
    const acrossT = random.next();
    const sy = random.range(1.3, 3.1);
    const sx = random.range(0.35, 0.68);
    const [minA, maxA] = acrossWindow(def, r, 0.42);
    if (minA >= maxA) {
      continue;
    }
    const across = side * (minA + acrossT * (maxA - minA));
    const { x, z } = wedgePoint(def, r, across);
    spots.push({
      x,
      // Embedded a fifth of a metre into the roof: the icicle pierces the
      // ceiling visually from above rather than hanging off its underside.
      y: wingCeiling(def, x, z) + 0.2,
      z,
      tiltX: random.signed(0.03),
      yaw: random.range(0, Math.PI * 2),
      // Flipped: the buried foot sits inside the roof, the point hangs.
      tiltZ: Math.PI + random.signed(0.03),
      sx,
      sy,
      sz: sx * random.range(0.85, 1.1),
      tone: SPIRE_TONES[Math.floor(random.next() * SPIRE_TONES.length)] ?? SPIRE_TONES[0],
      fade: random.range(0.92, 1.1),
    });
  }

  // Shared with the spires: one crystal, one material, three readings.
  return instancedCrystals("ice-icicles", crystalGeometry(SPIRE_PROFILE), CRYSTAL_MATERIAL_OPTIONS, spots);
}

/**
 * The frost rosettes: the seaweed field's rosette idiom regrown frost-pale
 * and kept in this module (the wave shares one tree, and no wing's flora
 * should build against a module another package is mid-edit on). Pressed
 * low, nestled along the wall feet either side of the corridor. Nothing
 * sways — this wing's stillness is the emotion.
 */
function buildRosettes(def: WingDef): InstancedMesh {
  const random = new Random(SEEDS.wingIceGrotto ^ 0xf407);
  const geometry = frostRosetteGeometry();
  const material = createToonMaterial({
    side: DoubleSide,
    vertexColors: true,
    emissive: 0x9db4dd,
    emissiveIntensity: 0.06,
  });

  const count = 30;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "ice-rosettes";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const r = 35 + i * 0.42 + random.signed(0.35);
    const side = i % 3 === 0 ? -1 : 1;
    const acrossT = random.next();
    const scale = random.range(0.5, 0.8);
    const yaw = random.range(0, Math.PI * 2);
    const fade = random.range(0.86, 1.06);
    const tone = FROST_TONES[Math.floor(random.next() * FROST_TONES.length)] ?? FROST_TONES[0];
    const [minA, maxA] = acrossWindow(def, r, 0.82);
    if (minA >= maxA) {
      continue;
    }
    const across = side * (minA + acrossT * (maxA - minA));
    const { x, z } = wedgePoint(def, r, across);
    dummy.position.set(x, seabedHeight(x, z) - 0.03, z);
    dummy.rotation.set(0, yaw, 0);
    // Pressed: frost creeps along the ground rather than standing up.
    dummy.scale.set(scale, scale * 0.62, scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(tone).multiplyScalar(fade);
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

/**
 * The glitter: a sparse cloud of tiny, very slow motes hanging in the cold
 * water — the grotto's one movement, sized to stay a whisper. The bowl's
 * mote idiom (additive points, soft sprite, per-point twinkle in the colour
 * attribute) at a third of its rate. `update(time)` is called from the
 * flora's own `update`, which owns the clock and the becalming.
 */
function buildGlitter(def: WingDef): { points: Points; update: (time: number) => void } {
  const random = new Random(SEEDS.wingIceGrotto ^ 0x9117);
  const count = 120;
  const base = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const rates = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = random.range(32, 48.5);
    const [minA, maxA] = acrossWindow(def, r, 0);
    const side = random.next() < 0.5 ? -1 : 1;
    const across = side * (minA + random.next() * Math.max(0, maxA - minA));
    const { x, z } = wedgePoint(def, r, across);
    const floor = seabedHeight(x, z);
    const cap = Math.min(4.2, wingCeiling(def, x, z) - floor - 0.9);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + random.range(0.5, Math.max(0.6, cap));
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, Math.PI * 2);
    rates[i] = random.range(0.12, 0.4);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(base.slice(), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    color: 0xdfe9ff,
    size: 0.09,
    map: glitterSprite(),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
    fog: false,
  });

  const points = new Points(geometry, material);
  points.name = "ice-glitter";

  const update = (time: number): void => {
    const position = geometry.attributes.position!;
    const color = geometry.attributes.color!;
    const posArray = position.array as Float32Array;
    const colArray = color.array as Float32Array;
    for (let i = 0; i < count; i++) {
      // A drift so slow it reads as stillness that happens to sparkle.
      posArray[i * 3] = base[i * 3]! + Math.sin(time * 0.1 + i) * 0.12;
      posArray[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(time * 0.07 + i * 0.5) * 0.1;
      posArray[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(time * 0.09 + i) * 0.12;
      const level = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * rates[i]! + phases[i]!));
      colArray[i * 3] = level;
      colArray[i * 3 + 1] = level;
      colArray[i * 3 + 2] = level;
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
  };
  return { points, update };
}

/** The glitter's soft spark: a bright core inside a small round falloff. */
let glitterSpriteTexture: DataTexture | undefined;
function glitterSprite(): DataTexture {
  glitterSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const core = Math.pow(Math.max(0, 1 - distance), 1.6);
    return [core, core, core];
  });
  return glitterSpriteTexture;
}

/**
 * One frost rosette: eight straps arching out from one root, each bowed
 * over its own arc — the seaweed rosette's integrated bow, kept local to
 * this wing (see the note on {@link buildRosettes}), a touch broader and
 * flatter for frost. Deterministic, no draws.
 */
function frostRosetteGeometry(): BufferGeometry {
  const straps: BufferGeometry[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const strap = frostStrapGeometry(0.85 + (i % 3) * 0.14, 0.13);
    const turn = (i / count) * Math.PI * 2 + i * 0.31;
    const tiltOut = 0.3 + (i % 2) * 0.16;
    strap.applyMatrix4(
      new Matrix4().makeRotationY(turn).multiply(new Matrix4().makeRotationX(tiltOut)),
    );
    straps.push(strap);
  }
  const merged = mergeGeometries(straps, false);
  for (const strap of straps) {
    strap.dispose();
  }
  if (!merged) {
    throw new Error("frost rosette straps could not be merged");
  }
  return merged;
}

/** One drooping frost strap, integrated along a bend past the horizontal. */
function frostStrapGeometry(length: number, width: number): BufferGeometry {
  const segments = 5;
  const geometry = new PlaneGeometry(width, length, 1, segments);
  const position = geometry.attributes.position!;

  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const step = length / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    const angle = 1.85 * Math.pow((row + 0.5) / segments, 1.5);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + length / 2) / length;
    const row = Math.round(t * segments);
    position.setX(i, position.getX(i) * (1 - t * 0.65));
    position.setY(i, arcY[row] ?? 0);
    position.setZ(i, arcZ[row] ?? 0);
    const shade = 0.7 + t * 0.38;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
