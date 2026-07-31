import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  Vector3,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { mergedMesh, smoothstep01 } from "./Verdant3Shared";
import type { MesaCrown } from "./Verdant3Mesas";
import { SUNFALL, channelCenter, spokeOf, worldOf } from "./Verdant3Terrain";

/**
 * THE OLD CANOPY — the ancient crowns the kelp sea grew from. Thirty
 * primeval trees (24–34 m trunks, painted bark, moss collars) carry a
 * near-continuous ceiling of broad crown pads between the mesas; the
 * mesa plateaus wear their own garden-pad crowns; and the whole roof
 * parts over the Sunfall Well, where the region's great shaft falls.
 *
 * The pads live above the swim ceiling (−6): unreachable sky, painted
 * for the view from below — deep violet-green undersides whose rims
 * lift toward milky light (the sky-through-leaves edge), gold-green
 * tops for the poses that look across the roof from the rampart.
 *
 * Everything merges into three area chunks (pass/heart/far) so the
 * whole forest costs three draws and culls honestly.
 */

const SEED = SEEDS.regionVerdant3;

interface TreeSpec {
  readonly u: number;
  readonly v: number;
  readonly height: number;
}

/** The authored meadow and rim stands (gate + descent trees are placed
 *  relative to the channel at build time). */
const MEADOW_TREES: readonly TreeSpec[] = [
  { u: 1352, v: -8, height: 30 },
  { u: 1368, v: 70, height: 28 },
  { u: 1360, v: -58, height: 27 },
  { u: 1398, v: 8, height: 32 },
  { u: 1418, v: 62, height: 29 },
  { u: 1432, v: -62, height: 31 },
  { u: 1470, v: 44, height: 30 },
  { u: 1488, v: -66, height: 28 },
  { u: 1502, v: 20, height: 33 },
  { u: 1516, v: -28, height: 30 },
  { u: 1538, v: 48, height: 28 },
  { u: 1544, v: -12, height: 31 },
  { u: 1566, v: 8, height: 27 },
  { u: 1560, v: 70, height: 26 },
  { u: 1580, v: -46, height: 28 },
  { u: 1602, v: 26, height: 25 },
] as const;

/** The rim stand: eight elders on the rampart slope, holding the
 *  skyline where the mesas do not. φ is the spoke-relative bearing. */
const RIM_TREES: readonly { phi: number; height: number }[] = [
  { phi: 0.4, height: 26 },
  { phi: 1.0, height: 25 },
  { phi: 1.6, height: 27 },
  { phi: 2.3, height: 24 },
  { phi: -0.4, height: 26 },
  { phi: -1.0, height: 28 },
  { phi: -1.7, height: 25 },
  { phi: -2.3, height: 27 },
] as const;

export interface Verdant3CanopyBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

// ─── The trunk lathe ────────────────────────────────────────────────────────

const TRUNK_RINGS = 9;
const TRUNK_SEGMENTS = 10;

function trunkGeometry(seed: number, height: number, footR: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring < TRUNK_RINGS; ring++) {
    const t = ring / (TRUNK_RINGS - 1);
    const y = t * height;
    const lean = (fbm(t * 4 + 2, 3.7, { seed: seed ^ 0x21, period: 4, octaves: 2 }) - 0.5) * footR * 2.4 * t;
    const leanZ = (fbm(t * 4 + 9, 1.3, { seed: seed ^ 0x37, period: 4, octaves: 2 }) - 0.5) * footR * 2.4 * t;
    const base = footR * (0.4 + 0.6 * Math.pow(1 - t, 1.5)) + footR * 0.12 * smoothstep01((t - 0.9) / 0.1);
    for (let s = 0; s <= TRUNK_SEGMENTS; s++) {
      const a = (s / TRUNK_SEGMENTS) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const rough =
        1 + (fbm(nx + 3, nz + t * 5, { seed, period: 4, octaves: 2 }) - 0.5) * 0.3;
      const r = base * rough;
      positions.push(lean + nx * r, y, leanZ + nz * r);

      // Bark paint: warm brown over green, moss collars at seeded
      // heights, a violet root shadow — never black anywhere. Round 2:
      // contrast doubled — the r1 trunks read as flat plastic columns.
      const collar = Math.max(0, Math.sin(y * 0.6 + seed % 5)) ** 2;
      const streak = smoothstep01(
        (fbm(nx * 1.8, nz * 1.8 + t, { seed: seed ^ 0x51, period: 5, octaves: 2 }) - 0.42) / 0.26,
      );
      const grain =
        (fbm(nx * 3.2 + 11, nz * 3.2 + t * 9, { seed: seed ^ 0x77, period: 8, octaves: 2 }) - 0.5) *
        0.2;
      let cr = 0.54 + streak * 0.14 + grain;
      let cg = 0.46 + streak * 0.16 + grain;
      let cb = 0.34 + streak * 0.08 + grain * 0.8;
      cr += (0.36 - cr) * collar * 0.85;
      cg += (0.64 - cg) * collar * 0.85;
      cb += (0.4 - cb) * collar * 0.85;
      const root = 1 - smoothstep01(t / 0.12);
      cr += (0.42 - cr) * root * 0.6;
      cg += (0.38 - cg) * root * 0.6;
      cb += (0.5 - cb) * root * 0.6;
      // The crown collar lifts toward the light it lives in.
      const crownLift = smoothstep01((t - 0.85) / 0.15);
      cr += (0.66 - cr) * crownLift;
      cg += (0.78 - cg) * crownLift;
      cb += (0.52 - cb) * crownLift;
      colors.push(cr, cg, cb);
    }
  }

  const stride = TRUNK_SEGMENTS + 1;
  for (let ring = 0; ring < TRUNK_RINGS - 1; ring++) {
    for (let s = 0; s < TRUNK_SEGMENTS; s++) {
      const a = ring * stride + s;
      const b = a + stride;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Non-indexed so trunks and pads merge into one chunk (the pads'
  // polyhedra are non-indexed by construction).
  if (!geometry.getIndex()) {
    return geometry;
  }
  const expanded = geometry.toNonIndexed();
  geometry.dispose();
  return expanded;
}

// ─── The crown pads ─────────────────────────────────────────────────────────

/**
 * One canopy pad: a squashed, noise-torn icosphere painted for the view
 * from below — violet-green underside, milky rim edge, gold-green top.
 * Round 2: the r1 pads read as flat teal mushroom-discs and flying
 * saucers — the silhouette gains a radial fbm tear (lobed, drooped
 * edges), the squash varies wider, and the underside drops a value
 * toward violet so the roof reads as shaded foliage, not fog.
 */
function padGeometry(random: Random): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 1);
  const noiseSeed = Math.floor(random.range(1, 1 << 20));
  const squash = random.range(0.24, 0.42);
  geometry.scale(random.range(0.85, 1.3), squash, random.range(0.85, 1.3));
  const position = geometry.attributes.position!;
  // The tear: radial displacement keyed on direction, drooping the
  // widest lobes so the crown's edge hangs like real foliage.
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const radial = Math.hypot(x, z);
    if (radial < 0.15) {
      continue;
    }
    const nx = x / radial;
    const nz = z / radial;
    const lobe =
      0.72 +
      0.55 * fbm(nx * 1.4 + 7, nz * 1.4 + noiseSeed * 0.001, { seed: noiseSeed, period: 4, octaves: 2 });
    position.setX(i, x * lobe);
    position.setZ(i, z * lobe);
    // Rim droop: the outer skirt bends down past the belly line.
    const reach = Math.min(1, radial * lobe);
    position.setY(i, position.getY(i) - reach * reach * squash * random.range(0.5, 0.8));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const radial = Math.hypot(position.getX(i), position.getZ(i));
    const rim = smoothstep01((radial - 0.7) / 0.5);
    let cr: number;
    let cg: number;
    let cb: number;
    if (y > -squash * 0.2) {
      // The top: gold-green in the high light.
      cr = 0.62 + rim * 0.08;
      cg = 0.88;
      cb = 0.5;
    } else {
      // The underside: deep violet-green, a colour holding shadow.
      cr = 0.36;
      cg = 0.34;
      cb = 0.48;
    }
    // The rim: the sky-through-leaves edge, lifted toward milk.
    cr += (0.76 - cr) * rim * 0.7;
    cg += (0.96 - cg) * rim * 0.7;
    cb += (0.72 - cb) * rim * 0.7;
    colors[i * 3] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.deleteAttribute("uv");
  return geometry;
}

function keepClearOfSunfall(u: number, v: number, margin: number): boolean {
  return Math.hypot(u - SUNFALL.u, v - SUNFALL.v) > SUNFALL.radius + margin;
}

// ─── The build ──────────────────────────────────────────────────────────────

export function buildVerdant3Canopy(
  crowns: readonly MesaCrown[],
  fallenHead: { x: number; z: number; y: number },
): Verdant3CanopyBuild {
  const treeRandom = new Random(SEED ^ 0x1e01);
  const padRandom = new Random(SEED ^ 0x1e02);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // Three area chunks for honest culling.
  const chunkPass: BufferGeometry[] = [];
  const chunkHeart: BufferGeometry[] = [];
  const chunkFar: BufferGeometry[] = [];
  const chunkOf = (u: number): BufferGeometry[] =>
    u < 1335 ? chunkPass : u < 1525 ? chunkHeart : chunkFar;

  interface PlacedTree {
    readonly x: number;
    readonly z: number;
    readonly topY: number;
    readonly u: number;
    readonly v: number;
  }
  const placed: PlacedTree[] = [];

  const plantTree = (u: number, v: number, height: number): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z) - 0.5;
    const footR = treeRandom.range(1.3, 1.9);
    const trunk = trunkGeometry(SEED ^ (0x1e10 + placed.length * 13), height, footR);
    trunk.applyMatrix4(new Matrix4().makeRotationY(treeRandom.range(0, Math.PI * 2)));
    trunk.translate(x, y, z);
    chunkOf(u).push(trunk);
    contacts.push({ x, z, radius: footR * 1.8, strength: 0.4 });
    for (const lift of [0.3, 0.62, 0.9]) {
      colliders.push({
        center: new Vector3(x, y + height * lift, z),
        radius: footR * (1.5 - lift * 0.6),
      });
    }
    placed.push({ x, z, topY: y + height, u, v });
  };

  // The Eaves Gate pair: the first over-arching crowns of the province's
  // last chamber, framing the descent's mouth.
  plantTree(1249, channelCenter(1249) - 11, 28);
  plantTree(1250, channelCenter(1250) + 11.5, 30);
  // The descent flanks: the Boughfall runs under their boughs.
  plantTree(1268, channelCenter(1268) - 13, 26);
  plantTree(1281, channelCenter(1281) + 14, 28);
  plantTree(1295, channelCenter(1295) - 15, 29);
  plantTree(1307, channelCenter(1307) + 16, 30);
  // The meadow elders.
  for (const tree of MEADOW_TREES) {
    plantTree(tree.u, tree.v, tree.height);
  }
  // The rim stand on the rampart slope.
  for (const rim of RIM_TREES) {
    const u = 1460 + 158 * Math.cos(rim.phi);
    const v = 158 * Math.sin(rim.phi);
    plantTree(u, v, rim.height);
  }

  // ─── The crown pads ────────────────────────────────────────────────────────
  const dummy = new Matrix4();
  const addPad = (
    bucket: BufferGeometry[],
    x: number,
    z: number,
    y: number,
    radius: number,
    tilt: number,
  ): void => {
    const pad = padGeometry(padRandom);
    pad.scale(radius, radius, radius);
    pad.applyMatrix4(dummy.makeRotationZ(padRandom.signed(tilt)));
    pad.applyMatrix4(dummy.makeRotationY(padRandom.range(0, Math.PI * 2)));
    pad.translate(x, y, z);
    bucket.push(pad);
  };

  for (const tree of placed) {
    // Round 2: one broad mother pad low over the trunk plus a ring of
    // smaller satellites — the r1 even-sized pads read as parasols.
    const pads = 4 + Math.floor(padRandom.next() * 3);
    for (let i = 0; i < pads; i++) {
      const mother = i === 0;
      const a = padRandom.range(0, Math.PI * 2);
      const reach = mother ? padRandom.range(0, 1.5) : padRandom.range(2, 5.5);
      const px = tree.x + Math.cos(a) * reach;
      const pz = tree.z + Math.sin(a) * reach;
      // The roof parts over the Sunfall Well — approximate the pad's
      // spoke position by the tree's own plus the local offset.
      if (!keepClearOfSunfall(tree.u + Math.cos(a) * reach, tree.v + Math.sin(a) * reach, 3)) {
        continue;
      }
      addPad(
        chunkOf(tree.u),
        px,
        pz,
        tree.topY + (mother ? 0.4 : padRandom.signed(2.2)),
        mother ? padRandom.range(6, 8.4) : padRandom.range(3, 5.4),
        0.16,
      );
    }
  }

  // The mesa crown gardens: denser, bigger pads on every plateau.
  for (const crown of crowns) {
    const pads = 4 + Math.floor(padRandom.next() * 3);
    for (let i = 0; i < pads; i++) {
      const a = padRandom.range(0, Math.PI * 2);
      const reach = padRandom.range(0, crown.topR * 0.9);
      addPad(
        chunkOf(spokeOf(crown.x, crown.z).u),
        crown.x + Math.cos(a) * reach,
        crown.z + Math.sin(a) * reach,
        crown.topY + 0.6 + padRandom.signed(1.2),
        padRandom.range(2.6, 4.8),
        0.16,
      );
    }
  }

  // The Fallen Mesa's crown still grows — sideways, off the propped
  // head: three tilted pads, the garden that would not stop.
  for (let i = 0; i < 3; i++) {
    const a = padRandom.range(0, Math.PI * 2);
    addPad(
      chunkFar,
      fallenHead.x + Math.cos(a) * padRandom.range(0.5, 3),
      fallenHead.z + Math.sin(a) * padRandom.range(0.5, 3),
      fallenHead.y + padRandom.range(0.5, 2.4),
      padRandom.range(2.2, 3.6),
      0.5,
    );
  }

  const material = createToonMaterial({ vertexColors: true });
  const meshes: Mesh[] = [];
  for (const [name, parts] of [
    ["verdant3-canopy-pass", chunkPass],
    ["verdant3-canopy-heart", chunkHeart],
    ["verdant3-canopy-far", chunkFar],
  ] as const) {
    if (parts.length > 0) {
      meshes.push(mergedMesh(parts, material, name));
    }
  }

  return { meshes, colliders, contacts };
}
