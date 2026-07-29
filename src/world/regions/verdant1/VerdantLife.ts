import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CircleGeometry,
  ConeGeometry,
  DoubleSide,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  Vector3,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import { buildColorTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./VerdantShared";
import type { KelpFoot } from "./VerdantKelp";
import { SUNWELL, worldOf } from "./VerdantTerrain";

/**
 * The Great Kelp Sea's ambient life: the leaf-drift, two shoal behaviours,
 * the current serpent, and the floor fauna.
 *
 * - **Leaf-drift**: six hundred golden motes (one additive `Points` draw)
 *   plus three dozen true leaf cards tumbling on the current (one
 *   instanced draw) — the forest is always shedding.
 * - **The meadow shimmer**: a travelling shoal of silversides riding a
 *   seeded ellipse over the Rolling Meadows' swells.
 * - **The canopy grazers**: an anchored cloud of warm-gold fry quivering
 *   under the Elder's crown — the second behaviour, hover where the first
 *   travels.
 * - **The current serpent**: the moving centrepiece. A hundred-and-ten
 *   silver fish swim one closed line through the forest — down the aisle,
 *   around the Elder, past the Sunwell's rim — nose to tail, so the shoal
 *   reads as a single body winding between the trunks.
 * - **Floor fauna**: emerald cushion stars on the meadows and Sunwell,
 *   plum urchins in the maze's half-light — the bowl's idioms wearing this
 *   region's paint (tips lit, undersides violet, nothing near black).
 *
 * Everything draws from `SEED ^` substreams at build; the update phase
 * spends no randomness at all, so a capture's settle is deterministic.
 */

const SEED = SEEDS.regionVerdant1;

export interface VerdantLifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

export function buildVerdantLife(giants: readonly KelpFoot[]): VerdantLifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];

  // ─── The leaf-drift ──────────────────────────────────────────────────────
  const motes = buildMotes();
  meshes.push(motes.points);
  updaters.push(motes.update);

  const leaves = buildDriftLeaves();
  meshes.push(leaves.mesh);
  updaters.push(leaves.update);

  // ─── The meadow shimmer ──────────────────────────────────────────────────
  const shimmer = buildShoal({
    seed: SEED ^ 0x5a01,
    count: 60,
    color: new Color(0xaed2cd),
    profile: { width: 0.9, height: 0.9, length: 1.05, tailTaper: 0.5, dorsal: 0.5, pectoral: 0.9, tail: { reach: 1.5, lobe: 0.62, notch: 1.05 } },
    scale: 0.85,
    behaviour: {
      kind: "travel",
      centerU: 330,
      centerV: 12,
      radiusU: 52,
      radiusV: 40,
      height: 3.4,
      rate: 0.055,
      bob: 1.1,
    },
  });
  meshes.push(shimmer.mesh);
  updaters.push(shimmer.update);

  // ─── The canopy grazers ──────────────────────────────────────────────────
  const grazers = buildShoal({
    seed: SEED ^ 0x5a02,
    count: 44,
    // Green-gold outright: even olive-cream measured salmon against the
    // cyan in round 3 — a small body under the warm key needs green *in*
    // the colour, not adjacent to it.
    color: new Color(0x8fb85c),
    profile: { width: 1.0, height: 1.35, length: 0.8, tailTaper: 0.5, dorsal: 0.9, pectoral: 1.1, tail: { reach: 1.35, lobe: 0.7, notch: 1.0 } },
    scale: 0.6,
    behaviour: {
      kind: "hover",
      centerU: 433,
      centerV: -16,
      spread: 5.5,
      height: 13.5,
      rate: 0.11,
    },
  });
  meshes.push(grazers.mesh);
  updaters.push(grazers.update);

  // ─── The current serpent ─────────────────────────────────────────────────
  const serpent = buildSerpent(giants);
  meshes.push(serpent.mesh);
  updaters.push(serpent.update);

  // ─── The floor fauna ─────────────────────────────────────────────────────
  meshes.push(buildStarfish(), buildUrchins());

  return {
    meshes,
    update(dt: number, time: number, reducedMotion: boolean): void {
      const calm = reducedMotion ? 0.45 : 1;
      for (const update of updaters) {
        update(dt, time, calm);
      }
    },
  };
}

// ─── The leaf-drift motes ────────────────────────────────────────────────────

let moteSprite: DataTexture | undefined;
function moteTexture(): DataTexture {
  moteSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.2);
    return [halo, halo * 0.92, halo * 0.5];
  });
  return moteSprite;
}

function buildMotes(): { points: Points; update: (dt: number, time: number, calm: number) => void } {
  const random = new Random(SEED ^ 0x40e5);
  const count = 600;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Drift through the whole sea, vale included — the forest upstream is
    // always shedding, and a mote crossing a beam is the vale's only spark.
    const u = random.range(90, 590);
    const v = u < 292 ? random.signed(14) : random.signed(120);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + random.range(0.6, 14);
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, Math.PI * 2);
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.09,
    map: moteTexture(),
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "verdant-leaf-motes";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.11 + p) * 1.6 + t * 0.06 * Math.sin(p);
        live[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.07 + p * 1.7) * 0.9;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.09 + p) * 1.6;
      }
      attribute.needsUpdate = true;
    },
  };
}

/** True leaf cards tumbling on the current — the drift the eye can follow. */
function buildDriftLeaves(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x40e6);
  const count = 36;
  const geometry = new CircleGeometry(0.16, 6);
  geometry.scale(1, 0.42, 1);
  const material = createToonMaterial({ color: 0x9aa050, side: DoubleSide });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant-drift-leaves";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const homes: { x: number; y: number; z: number; phase: number; spin: number }[] = [];
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    const u = random.range(320, 560);
    const v = random.signed(100);
    const { x, z } = worldOf(u, v);
    homes.push({
      x,
      y: seabedHeight(x, z) + random.range(1.5, 12),
      z,
      phase: random.range(0, Math.PI * 2),
      spin: random.range(0.4, 1.1),
    });
    tint.setHex([0x9aa050, 0xb0a558, 0x7f9048][i % 3]!).multiplyScalar(random.range(0.85, 1.1));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  return {
    mesh,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (const [i, home] of homes.entries()) {
        dummy.position.set(
          home.x + Math.sin(t * 0.13 + home.phase) * 2.2 + t * 0.08 * Math.sin(home.phase),
          home.y + Math.sin(t * 0.09 + home.phase * 1.7) * 1.4,
          home.z + Math.cos(t * 0.11 + home.phase) * 2.2,
        );
        dummy.rotation.set(t * home.spin, home.phase, t * home.spin * 0.7);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ─── The shoals ──────────────────────────────────────────────────────────────

interface TravelBehaviour {
  readonly kind: "travel";
  readonly centerU: number;
  readonly centerV: number;
  readonly radiusU: number;
  readonly radiusV: number;
  readonly height: number;
  readonly rate: number;
  readonly bob: number;
}

interface HoverBehaviour {
  readonly kind: "hover";
  readonly centerU: number;
  readonly centerV: number;
  readonly spread: number;
  readonly height: number;
  readonly rate: number;
}

interface ShoalOptions {
  readonly seed: number;
  readonly count: number;
  readonly color: Color;
  readonly profile: Parameters<typeof createFishGeometry>[0];
  readonly scale: number;
  readonly behaviour: TravelBehaviour | HoverBehaviour;
}

function buildShoal(options: ShoalOptions): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(options.seed);
  const geometry = createFishGeometry(options.profile);
  const material = createToonMaterial({ vertexColors: true });
  const mesh = new InstancedMesh(geometry, material, options.count);
  mesh.name = `verdant-shoal-${options.behaviour.kind}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const offsets: { a: number; r: number; h: number; phase: number; scale: number }[] = [];
  const tint = new Color();
  for (let i = 0; i < options.count; i++) {
    offsets.push({
      a: random.range(0, Math.PI * 2),
      r: random.range(0, 1),
      h: random.signed(1),
      phase: random.range(0, Math.PI * 2),
      scale: options.scale * random.range(0.8, 1.2),
    });
    tint.copy(options.color).multiplyScalar(random.range(0.85, 1.12));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const behaviour = options.behaviour;

  const update = (_dt: number, time: number, calm: number): void => {
    const t = time * calm;
    if (behaviour.kind === "travel") {
      const angle = t * behaviour.rate * Math.PI * 2;
      for (const [i, o] of offsets.entries()) {
        const a = angle + o.a * 0.22;
        const u = behaviour.centerU + Math.cos(a) * behaviour.radiusU * (0.82 + o.r * 0.24);
        const v = behaviour.centerV + Math.sin(a) * behaviour.radiusV * (0.82 + o.r * 0.24);
        const { x, z } = worldOf(u, v);
        const y =
          seabedHeight(x, z) +
          behaviour.height +
          Math.sin(t * 0.5 + o.phase) * behaviour.bob +
          o.h * 1.3;
        dummy.position.set(x, y, z);
        // Heading: the ellipse's own tangent, in world space.
        const du = -Math.sin(a) * behaviour.radiusU;
        const dv = Math.cos(a) * behaviour.radiusV;
        const from = worldOf(u, v);
        const to = worldOf(u + du * 0.01, v + dv * 0.01);
        dummy.rotation.set(0, Math.atan2(to.x - from.x, to.z - from.z), 0);
        dummy.scale.setScalar(o.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    } else {
      const { x: cx, z: cz } = worldOf(behaviour.centerU, behaviour.centerV);
      const cy = seabedHeight(cx, cz) + behaviour.height;
      for (const [i, o] of offsets.entries()) {
        const a = o.a + t * behaviour.rate * (0.6 + o.r * 0.8);
        const r = behaviour.spread * (0.3 + o.r * 0.7);
        const x = cx + Math.cos(a) * r + Math.sin(t * 0.9 + o.phase) * 0.3;
        const z = cz + Math.sin(a) * r + Math.cos(t * 1.1 + o.phase) * 0.3;
        const y = cy + o.h * 2.2 + Math.sin(t * 0.7 + o.phase) * 0.5;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, a + Math.PI / 2, 0);
        dummy.scale.setScalar(o.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  // Pose once so the first frame is a shoal, not a stack at the origin.
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The current serpent ─────────────────────────────────────────────────────

/**
 * One closed line through the forest, nudged off every trunk, that a
 * hundred and ten silver fish follow nose to tail. The path is authored
 * through the region's own landmarks — in at the vale's mouth-side meadow,
 * down the aisle, a loop around the Elder, along the Sunwell's rim and
 * back through the eaves — so following the serpent *is* the tour.
 */
function buildSerpent(giants: readonly KelpFoot[]): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x5e59);
  const stations: [number, number, number][] = [
    [318, 6, 3.2],
    [352, 26, 4.5],
    [392, 44, 6],
    [428, 30, 8],
    [438, -8, 9],
    [424, -30, 7],
    [408, -16, 6.5],
    [426, 4, 7],
    [458, 26, 9],
    [482, 40, 8],
    [500, 22, 7.5],
    [488, -6, 8],
    [462, -28, 7],
    [430, -44, 6],
    [396, -34, 5],
    [362, -20, 4],
    [336, -8, 3.4],
  ];
  const points: Vector3[] = [];
  for (const [u, v, lift] of stations) {
    // Nudge each station off the nearest trunk so the line threads the
    // forest rather than clipping it.
    let su = u;
    let sv = v;
    for (const g of giants) {
      const d = Math.hypot(g.u - su, g.v - sv);
      if (d < 4 && d > 1e-3) {
        su += ((su - g.u) / d) * (4 - d);
        sv += ((sv - g.v) / d) * (4 - d);
      }
    }
    const { x, z } = worldOf(su, sv);
    points.push(new Vector3(x, seabedHeight(x, z) + lift + random.signed(0.4), z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 76;
  const geometry = createFishGeometry({
    width: 0.85,
    height: 0.95,
    length: 1.15,
    tailTaper: 0.52,
    dorsal: 0.4,
    pectoral: 0.8,
    tail: { reach: 1.5, lobe: 0.6, notch: 1.05 },
  });
  const material = createToonMaterial({ vertexColors: true });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant-current-serpent";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const tint = new Color();
  // Green-silver, taken down a real step. Measured across three rounds:
  // any pale tint under the 1.6 warm key overexposes into salmon, so the
  // body colour itself must sit below the blowout and carry green.
  const silver = new Color(0xa8cfc0);
  const offsets: { lateral: number; phase: number; scale: number }[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push({
      lateral: random.signed(0.32),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.9, 1.25),
    });
    tint.copy(silver).multiplyScalar(random.range(0.85, 1.05));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  // The body covers this fraction of the loop, nose to tail — tightened
  // in round 2 so the shoal reads as one ribbon, not scattered dots.
  const bodySpan = 0.12;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.011) % 1;
    for (const [i, o] of offsets.entries()) {
      const s = (((head - (i / count) * bodySpan) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.004) % 1, ahead);
      side.subVectors(ahead, at).cross(up).normalize();
      // The braid: each fish rides a little off the line, swinging with
      // its neighbours so the body's edge ripples like a ribbon.
      const swing = Math.sin(time * calm * 1.7 + i * 0.32 + o.phase * 0.2) * 0.22;
      at.addScaledVector(side, o.lateral + swing);
      at.y += Math.sin(time * calm * 1.3 + i * 0.21) * 0.22;
      dummy.position.copy(at);
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The floor fauna ─────────────────────────────────────────────────────────

/** A five-lobed cushion star, domed, tips lifted — one shared geometry. */
function starGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(0.22, 1);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const lobe = 0.62 + 0.38 * Math.pow(Math.abs(Math.cos(angle * 2.5)), 0.7);
    const r = Math.hypot(x, z);
    position.setX(i, x * lobe * (1 + r));
    position.setZ(i, z * lobe * (1 + r));
    position.setY(i, Math.max(0.005, position.getY(i) * 0.32 * (1 - r * 0.6)));
  }
  position.needsUpdate = true;
  smoothNormals(geometry);
  return geometry;
}

function buildStarfish(): InstancedMesh {
  const random = new Random(SEED ^ 0x57a5);
  const geometry = starGeometry();
  // Tip light: the lobes' ends catch the surface light, the disc holds the
  // deeper tone — baked once, multiplied by each instance's own colour.
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.5;
    const value = 0.72 + smoothstep01((r - 0.35) / 0.55) * 0.42;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value * 0.94;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = createToonMaterial({ vertexColors: true });
  const count = 26;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant-starfish";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const palette = [0x2e8a5e, 0xc07a5a, 0x8a5f9e];
  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // On the meadows and around the Sunwell's rim, where the light falls.
    const nearSunwell = random.next() < 0.4;
    const u = nearSunwell
      ? SUNWELL.u + random.signed(26)
      : 300 + random.next() * 100;
    const v = nearSunwell ? SUNWELL.v + random.signed(26) : random.signed(75);
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHex(palette[i % palette.length]!).multiplyScalar(random.range(0.85, 1.15));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** A plum urchin: low dome and a whorl of spines, merged once. */
function urchinGeometry(): BufferGeometry {
  const body = new IcosahedronGeometry(0.14, 1);
  body.scale(1, 0.75, 1);
  const parts: BufferGeometry[] = [body];
  const spikeRandom = new Random(SEED ^ 0x0bc1);
  for (let i = 0; i < 16; i++) {
    // A spine is a needle: three sides read exactly as twenty would at
    // this size, and the whorl is most of the animal's triangle bill.
    // Non-indexed to match the icosahedron body, or the merge fails (the
    // fish-tail trap: `mergeGeometries` rejects mixed indexing).
    const spike = new ConeGeometry(0.018, 0.3, 3).toNonIndexed();
    spike.translate(0, 0.15, 0);
    const theta = spikeRandom.range(0, Math.PI * 2);
    const tilt = spikeRandom.range(0.2, 1.25);
    spike.applyMatrix4(new Matrix4().makeRotationZ(tilt));
    spike.applyMatrix4(new Matrix4().makeRotationY(theta));
    parts.push(spike);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("verdant urchin parts could not be merged");
  }
  return merged;
}

function buildUrchins(): InstancedMesh {
  const random = new Random(SEED ^ 0x0bc2);
  const geometry = urchinGeometry();
  const material = createToonMaterial({ color: 0x5b4470 });
  const count = 18;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant-urchins";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // The maze's half-light, in clusters along the gully feet.
    const { x, z } = worldOf(470 + random.next() * 55, -110 + random.next() * 55);
    dummy.position.set(x, seabedHeight(x, z) + 0.04, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.8, 1.6));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    // Plum into wine — the darkest animal on the floor is a colour.
    tint.setHex(i % 3 === 0 ? 0x6d4a63 : 0x584472).multiplyScalar(random.range(0.85, 1.1));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}