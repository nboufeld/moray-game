import {
  BufferAttribute,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildGroundLitter } from "../kit/GroundLitter";
import { buildSpongeCluster } from "../kit/SpongeCluster";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import type { KelpFoot } from "./VerdantKelp";
import { mergedMesh, smoothstep01 } from "./VerdantShared";
import {
  FILL_SEEDS,
  aisleDistance,
  restFree,
} from "./VerdantFillShared";
import {
  ROOT_MAZE,
  fallingEdgeWeight,
  forestWeight,
  mazeWeight,
  spokeOf,
  sunwellWeight,
  valeChannelCenter,
  valeChannelHalf,
  verdantWeight,
  worldOf,
} from "./VerdantTerrain";

/**
 * The Great Kelp Sea's T2 understory (fill plan §3/§6b): the tier that did
 * not exist — the region's own answer to "the forest floor between trunks
 * is naked brown".
 *
 * Kit consumption: six `bushBank` palettes (vale ledge / meadow spring /
 * forest olive / maze wine / edge pale / Sunwell low), one `spongeCluster`
 * run down the vale's wall feet, and `groundLitter` carrying the fallen
 * limbs as caller geometry (MASTER R8 — exclusive shapes, kit scatter).
 *
 * Region EXCLUSIVES, authored here and nowhere else (fill plan §6b):
 *
 * 1. **Holdfast skirt** — a root-knuckle collar at every giant's foot
 *    (~208 tris), instanced once for all 39 giants: the single biggest
 *    fix for the naked forest floor.
 * 2. **Fallen limb** — three curved dead-strap variants (bark below,
 *    silvered top) scattered through the forest litter.
 * 3. **Dead spar** — four bare charcoal-olive stipes with stub crowns on
 *    the maze's ridges: the dark quarter's silhouette verticals.
 * 4. **Canopy pad card** — broad crown-top cards floated just above the
 *    canopy (cheap, unlit, vertex-painted) so `canopy-breach` finally has
 *    a sea of crowns to breach through.
 *
 * All streams are fresh `FILL_SEEDS.*` substreams (the reroll fence);
 * every gate multiplies {@link restFree}; the aisle's swim line is kept
 * clear while its WAYSIDE is dressed (doctrine rule 2: the road is a
 * place). Nothing here registers colliders — ankle-and-shoulder scenery.
 */

const SEED = SEEDS.regionVerdant1;

/** The skirt's paint: the stipe's own holdfast stops, violet-brown → olive. */
const SKIRT_DARK = new Color(0x54413a);
const SKIRT_LIGHT = new Color(0x77683f);

const PAD_TONES = [0x5f9450, 0x72a75c, 0x86a75a] as const;

export interface VerdantUnderstoryBuild {
  readonly groups: Group[];
  readonly meshes: Mesh[];
}

function discAreaAt(u: number, v: number, radius: number): KitArea {
  const { x, z } = worldOf(u, v);
  return { center: [x, z], radius };
}

// ─── Gates ───────────────────────────────────────────────────────────────────

/** Bushes hug the vale's wall feet, either side of the swimmable channel. */
const valeLedgeGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 60 || u > 252) {
    return 0;
  }
  const off = Math.abs(v - valeChannelCenter(u));
  const half = valeChannelHalf(u);
  const band = smoothstep01((off - half + 2) / 2) * (1 - smoothstep01((off - half - 5) / 3));
  return band * restFree(x, z);
};

const meadowBushGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  if (u < 292 || u > 440 || Math.abs(v) > 84) {
    return 0;
  }
  return (
    (1 - forestWeight(u, v) * 0.7) *
    (1 - mazeWeight(u, v)) *
    (1 - sunwellWeight(u, v)) *
    restFree(x, z) *
    verdantWeight(x, z)
  );
};

/** Forest bushes: dense at the wayside, off the swim line itself. */
const forestBushGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const aisle = aisleDistance(u, v);
  if (aisle < 3) {
    return 0.04;
  }
  const wayside = aisle < 9 ? 1 : 0.62;
  return (
    forestWeight(u, v) *
    wayside *
    (1 - sunwellWeight(u, v)) *
    (1 - mazeWeight(u, v)) *
    restFree(x, z)
  );
};

const mazeBushGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return mazeWeight(u, v) * restFree(x, z);
};

const edgeBushGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  return (
    fallingEdgeWeight(u) *
    (1 - mazeWeight(u, v)) *
    (1 - smoothstep01((u - 604) / 20)) *
    restFree(x, z) *
    verdantWeight(x, z)
  );
};

/** Low bushes OUTSIDE the Sunwell's ring only — the bowl is a rest. */
const sunwellOutsideGate: GateFn = (x, z) => {
  const { u, v } = spokeOf(x, z);
  const d = Math.hypot(u - 475, v - 58);
  return smoothstep01((d - 43) / 4) * (1 - smoothstep01((d - 54) / 6)) * restFree(x, z);
};

// ─── The build ───────────────────────────────────────────────────────────────

export function buildVerdantUnderstory(giants: readonly KelpFoot[]): VerdantUnderstoryBuild {
  const groups: Group[] = [];
  const meshes: Mesh[] = [];
  const keep = (build: KitBuild): void => {
    groups.push(build.group);
  };

  // ─── The six bush banks ──────────────────────────────────────────────────
  // R12.3: every bank opts into the kit's quality-pass richness — `fronds`
  // (drooping strap overhangs, the line that breaks the "smooth boulder"
  // read at swimming distance) and `accents` (berry/bud knots on each
  // palette's own accent ink, painted values, nothing glows). The wine
  // bank takes fewer, sparser fronds — dead scrub is thorny, not leafy.
  // Opting in re-welds each bank's own geometry (expected under the
  // fence: these families' buffers may re-roll; nothing else moves).
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.bushVale,
      palette: { base: 0x5d8a52, tip: 0x86b060, shade: 0x44603f, accent: 0x96525e },
      area: discAreaAt(155, 0, 118),
      gate: valeLedgeGate,
      ground: seabedHeight,
      count: 40,
      lobes: 4,
      scale: 0.72,
      fronds: 4,
      accents: 3,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.bushMeadow,
      palette: { base: 0x74a45c, tip: 0x9cc96e, shade: 0x527a4a, accent: 0xa8505c },
      area: discAreaAt(360, 0, 92),
      gate: meadowBushGate,
      ground: seabedHeight,
      count: 60,
      lobes: 4,
      scale: 0.9,
      fronds: 5,
      accents: 4,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.bushForest,
      palette: { base: 0x5f8a4c, tip: 0x8aa85c, shade: 0x3f5c3a, accent: 0x8a6a3e },
      area: discAreaAt(450, -10, 116),
      gate: forestBushGate,
      ground: seabedHeight,
      count: 70,
      lobes: 4,
      scale: 0.95,
      fronds: 5,
      accents: 3,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.bushMaze,
      // Round 2: deepened toward true wine — the r1 ramp read magenta.
      palette: { base: 0x54353f, tip: 0x704650, shade: 0x38232c, accent: 0x7e4640 },
      area: discAreaAt(ROOT_MAZE.u, ROOT_MAZE.v, 56),
      gate: mazeBushGate,
      ground: seabedHeight,
      count: 40,
      lobes: 4,
      scale: 0.8,
      fronds: 3,
      accents: 3,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.bushEdge,
      palette: { base: 0x9aa87e, tip: 0xc9cf9e, shade: 0x6e7a62, accent: 0xb0a06a },
      area: discAreaAt(580, 0, 78),
      gate: edgeBushGate,
      ground: seabedHeight,
      count: 20,
      lobes: 4,
      scale: 0.85,
      fronds: 3,
      accents: 2,
    }),
  );
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.bushSunwell,
      palette: { base: 0x8fb26a, tip: 0xc4d788, shade: 0x5d7a50, accent: 0xc9a860 },
      area: discAreaAt(475, 58, 56),
      gate: sunwellOutsideGate,
      ground: seabedHeight,
      count: 8,
      lobes: 4,
      scale: 0.62,
      fronds: 6,
      accents: 5,
    }),
  );

  // ─── The vale's sponges: +30 tubes on alternating wall feet ─────────────
  const spongeAnchors: { pos: readonly [number, number] }[] = [];
  for (const [i, u] of [88, 110, 134, 156, 182, 206, 232, 256].entries()) {
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = valeChannelCenter(u) + side * (valeChannelHalf(u) + 1.6);
    const { x, z } = worldOf(u, lateral);
    spongeAnchors.push({ pos: [x, z] });
  }
  keep(
    buildSpongeCluster({
      seed: SEED ^ FILL_SEEDS.sponges,
      // Round 2: the r1 ochre read traffic-cone RED against the green
      // water (complement contrast) — olive-tan barrels, wine accents.
      palette: { base: 0x8a7a4e, accent: 0x6e3a4e },
      ground: seabedHeight,
      anchors: spongeAnchors,
      tubesPerAnchor: 3,
      height: 1.0,
    }),
  );

  // ─── EXCLUSIVE 2: fallen limbs through the forest litter ────────────────
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.fallenLimbs,
      palette: { base: 0x9a8a6a, shade: 0x54402f },
      area: discAreaAt(450, -10, 112),
      gate: forestBushGate,
      ground: seabedHeight,
      count: 26,
      shapeSet: limbVariants(),
      size: [0.85, 1.35],
    }),
  );

  // ─── EXCLUSIVE 1: holdfast skirts on every giant's foot ─────────────────
  meshes.push(buildHoldfastSkirts(giants));

  // ─── EXCLUSIVE 3: the maze's dead spars ──────────────────────────────────
  meshes.push(buildDeadSpars());

  // ─── EXCLUSIVE 4: the above-canopy pad cards ─────────────────────────────
  meshes.push(buildCanopyPads(giants));

  return { groups, meshes };
}

// ─── Exclusive 1 — the holdfast skirt ────────────────────────────────────────

/**
 * One root-knuckle collar: arcing fingers gripping the ground around a low
 * collar cone, painted in the stipe's own holdfast stops so trunk and
 * skirt read as one plant. Instanced over all giant feet. R12.3 deepened
 * the collar — nine fingers (was seven) plus an inner ring of five short
 * knuckles (~340 tris, was ~208), because at 2 m the seven-finger skirt
 * read as a sparse claw with sand between the toes.
 */
function skirtGeometry(random: Random): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const fingers = 9;
  for (let i = 0; i < fingers; i++) {
    const heading = (i / fingers) * Math.PI * 2 + random.signed(0.3);
    const reach = random.range(0.55, 1.0);
    const crown = random.range(0.34, 0.52);
    const from = new Vector3(
      Math.cos(heading) * 0.16,
      crown,
      Math.sin(heading) * 0.16,
    );
    const mid = new Vector3(
      Math.cos(heading) * reach * 0.55,
      crown * 0.55 + random.range(0.02, 0.08),
      Math.sin(heading) * reach * 0.55,
    );
    const to = new Vector3(Math.cos(heading) * reach, -0.08, Math.sin(heading) * reach);
    parts.push(
      new TubeGeometry(
        new CatmullRomCurve3([from, mid, to]),
        4,
        random.range(0.05, 0.085),
        3,
        false,
      ),
    );
  }

  // The inner knuckle ring: five short, steep grips filling the collar
  // between the long fingers — the mass the close read was missing.
  const knuckles = 5;
  for (let i = 0; i < knuckles; i++) {
    const heading = ((i + 0.5) / knuckles) * Math.PI * 2 + random.signed(0.4);
    const reach = random.range(0.28, 0.48);
    const crown = random.range(0.22, 0.36);
    parts.push(
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(Math.cos(heading) * 0.1, crown, Math.sin(heading) * 0.1),
          new Vector3(
            Math.cos(heading) * reach * 0.6,
            crown * 0.5,
            Math.sin(heading) * reach * 0.6,
          ),
          new Vector3(Math.cos(heading) * reach, -0.06, Math.sin(heading) * reach),
        ]),
        3,
        random.range(0.055, 0.08),
        3,
        false,
      ),
    );
  }

  const shade = new Color();
  for (const part of parts) {
    const position = part.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      // Sapwood light at the knuckle crown, violet-brown where the finger
      // meets the sand — the darkest point is a colour, never a black.
      const t = smoothstep01((position.getY(i) + 0.08) / 0.6);
      shade.copy(SKIRT_DARK).lerp(SKIRT_LIGHT, t);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    part.setAttribute("color", new BufferAttribute(colors, 3));
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("verdant holdfast skirt fingers could not be merged");
  }
  smoothNormals(merged);
  merged.computeBoundingSphere();
  return merged;
}

function buildHoldfastSkirts(giants: readonly KelpFoot[]): Mesh {
  const random = new Random(SEED ^ FILL_SEEDS.holdfastSkirts);
  const geometry = skirtGeometry(new Random(SEED ^ FILL_SEEDS.holdfastSkirts ^ 0x9e37));
  const material = createToonMaterial({ vertexColors: true });
  const mesh = new InstancedMesh(geometry, material, giants.length);
  mesh.name = "verdant-holdfast-skirts";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (const [index, giant] of giants.entries()) {
    const foot = seabedHeight(giant.x, giant.z);
    dummy.position.set(giant.x, foot + 0.02, giant.z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    const spread = random.range(1.15, 1.7) * (0.8 + giant.height / 60);
    dummy.scale.set(spread, random.range(0.85, 1.15), spread);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    const value = random.range(0.88, 1.12);
    tint.setRGB(value, value, value);
    mesh.setColorAt(index, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

// ─── Exclusive 2 — the fallen limb variants ──────────────────────────────────

/** A curved dead strap: bark below, a silvered top where thin light has
 *  been bleaching it — three lengths, fed to the kit scatter as caller
 *  geometry (MASTER R8). Radius ~0.5 so the kit's size knob is metres. */
function limbVariants(): BufferGeometry[] {
  const random = new Random(SEED ^ FILL_SEEDS.fallenLimbs ^ 0x9e37);
  const bark = new Color(0x54402f);
  const silver = new Color(0xb0a88e);
  const shade = new Color();
  const variants: BufferGeometry[] = [];
  for (const [length, sag] of [
    [1.0, 0.1],
    [1.5, 0.16],
    [2.1, 0.2],
  ] as const) {
    const half = length / 2;
    const bendZ = random.signed(0.3) * length;
    const curve = new CatmullRomCurve3([
      new Vector3(-half, 0.02, 0),
      new Vector3(random.signed(0.15), sag, bendZ * 0.5),
      new Vector3(half, 0.04, bendZ),
    ]);
    const tube = new TubeGeometry(curve, 6, 0.055 * (0.8 + length * 0.25), 4, false);
    tube.scale(1, 0.62, 1);
    tube.computeVertexNormals();
    const position = tube.attributes.position!;
    const normal = tube.attributes.normal!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const up = smoothstep01(normal.getY(i) * 0.5 + 0.5);
      shade.copy(bark).lerp(silver, up * up);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    tube.setAttribute("color", new BufferAttribute(colors, 3));
    variants.push(tube);
  }
  return variants;
}

// ─── Exclusive 3 — the dead spars ────────────────────────────────────────────

/**
 * Four bare charcoal-olive stipes with stub crowns, authored onto the
 * maze's ridges: the dark quarter's own silhouette verticals, dead
 * versions of the giants everywhere else. Charcoal-olive IS a colour —
 * red above green at the foot, olive light along the shaft.
 */
function buildDeadSpars(): Mesh {
  const random = new Random(SEED ^ FILL_SEEDS.deadSpars);
  const dark = new Color(0x453c30);
  const light = new Color(0x7a7452);
  const shade = new Color();
  const parts: BufferGeometry[] = [];

  const spots: readonly [number, number, number][] = [
    [ROOT_MAZE.u - 16, ROOT_MAZE.v + 14, 7.5],
    [ROOT_MAZE.u + 12, ROOT_MAZE.v - 16, 9],
    [ROOT_MAZE.u + 22, ROOT_MAZE.v + 16, 6.5],
    [ROOT_MAZE.u - 8, ROOT_MAZE.v - 30, 8.2],
  ];
  for (const [u, v, height] of spots) {
    const { x, z } = worldOf(u, v);
    const foot = seabedHeight(x, z);
    const lean = random.signed(0.12);
    const yaw = random.range(0, Math.PI * 2);
    const spine = new CatmullRomCurve3([
      new Vector3(x, foot - 0.2, z),
      new Vector3(x + lean * height * 0.5, foot + height * 0.55, z + lean * height * 0.3),
      new Vector3(x + lean * height, foot + height, z + lean * height * 0.6),
    ]);
    const shaft = new TubeGeometry(spine, 6, random.range(0.14, 0.22), 5, false);
    // Round 2: taper the shaft toward its tip — the constant-radius tube
    // read as a telegraph pole. Each ring is pulled toward the spine by
    // how high it stands.
    {
      const position = shaft.attributes.position!;
      const center = new Vector3();
      for (let i = 0; i < position.count; i++) {
        const t = Math.min(1, Math.max(0, (position.getY(i) - foot) / height));
        spine.getPoint(t, center);
        const pinch = 1 - 0.6 * Math.pow(t, 1.3);
        position.setX(i, center.x + (position.getX(i) - center.x) * pinch);
        position.setZ(i, center.z + (position.getZ(i) - center.z) * pinch);
      }
      shaft.computeVertexNormals();
    }
    parts.push(shaft);
    // The stub crown: broken strap starts that DROOP — they rise off the
    // tip, arc, and fall, so the crown reads as dead straps rather than
    // a signpost "T" (round 2, after the r1 critique).
    const stubs = 2 + Math.floor(random.next() * 2);
    for (let s = 0; s < stubs; s++) {
      const heading = yaw + (s / stubs) * Math.PI * 2 + random.signed(0.4);
      const top = spine.getPoint(1);
      const reach = random.range(0.6, 1.05);
      const stub = new TubeGeometry(
        new CatmullRomCurve3([
          top.clone(),
          new Vector3(
            top.x + Math.cos(heading) * reach * 0.5,
            top.y + random.range(0.06, 0.16),
            top.z + Math.sin(heading) * reach * 0.5,
          ),
          new Vector3(
            top.x + Math.cos(heading) * reach,
            top.y - random.range(0.2, 0.55),
            top.z + Math.sin(heading) * reach,
          ),
        ]),
        3,
        0.055,
        3,
        false,
      );
      parts.push(stub);
    }
    for (const part of parts.slice(-1 - stubs)) {
      const position = part.attributes.position!;
      const colors = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const t = smoothstep01((position.getY(i) - foot) / height);
        shade.copy(dark).lerp(light, t);
        colors[i * 3] = shade.r;
        colors[i * 3 + 1] = shade.g;
        colors[i * 3 + 2] = shade.b;
      }
      part.setAttribute("color", new BufferAttribute(colors, 3));
    }
  }

  const mesh = mergedMesh(parts, createToonMaterial({ vertexColors: true }), "verdant-dead-spars");
  return mesh;
}

// ─── Exclusive 4 — the above-canopy pad cards ────────────────────────────────

/** One broad crown pad: a seven-sided fan, gently domed, painted bright
 *  toward its heart so a sea of them reads as sunlit crowns from above. */
function padGeometry(): BufferGeometry {
  const geometry = new CircleGeometry(1, 7);
  geometry.rotateX(-Math.PI / 2);
  geometry.scale(1, 1, 0.72);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i));
    position.setY(i, (1 - r) * 0.14);
    // Bright gold-green heart, deep rim — the paint carries the drawing
    // because the material is unlit on purpose (cheap sky ceiling).
    const t = 1 - Math.min(1, r);
    colors[i * 3] = 0.52 + t * 0.4;
    colors[i * 3 + 1] = 0.62 + t * 0.38;
    colors[i * 3 + 2] = 0.34 + t * 0.16;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

function buildCanopyPads(giants: readonly KelpFoot[]): Mesh {
  const random = new Random(SEED ^ FILL_SEEDS.canopyPads);
  const geometry = padGeometry();
  // Unlit and fogged: from above, the pads are a painted sea of crowns
  // that still goes milky with distance; from below they close the
  // ceiling as dark leaf mass against the bright surface.
  const material = new MeshBasicMaterial({
    vertexColors: true,
    side: DoubleSide,
    toneMapped: true,
  });
  // Round 2: 5–6 pads per giant, wider and bigger — `canopy-up` still
  // showed too much open sky between the crowns at 4–5.
  const capacity = giants.length * 6;
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = "verdant-canopy-pads";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  let placed = 0;
  for (const giant of giants) {
    const foot = seabedHeight(giant.x, giant.z);
    const crownY = foot + giant.height;
    const pads = 5 + Math.floor(random.next() * 2);
    for (let i = 0; i < pads && placed < capacity; i++) {
      const heading = (i / pads) * Math.PI * 2 + random.signed(0.5);
      const out = random.range(0.8, 3.4);
      dummy.position.set(
        giant.x + Math.cos(heading) * out,
        crownY + random.range(-0.5, 1.0),
        giant.z + Math.sin(heading) * out,
      );
      dummy.rotation.set(random.signed(0.16), random.range(0, Math.PI * 2), random.signed(0.16));
      // Round 3: 1.3–2.6 left `canopy-breach`'s far crown band a flat teal
      // line — bigger pads are the free lever (same draws, same stream).
      const size = random.range(1.6, 3.0);
      dummy.scale.set(size, 1, size * random.range(0.8, 1.1));
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      tint.setHex(PAD_TONES[placed % PAD_TONES.length]!).multiplyScalar(random.range(0.85, 1.1));
      mesh.setColorAt(placed, tint);
      placed++;
    }
  }
  // Park the unplanted remainder far below the world.
  dummy.position.set(0, -300, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  const parkMatrix = new Matrix4().copy(dummy.matrix);
  for (let i = placed; i < capacity; i++) {
    mesh.setMatrixAt(i, parkMatrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}
