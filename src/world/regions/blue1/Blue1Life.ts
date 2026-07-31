import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
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
import { smoothstep01 } from "./Blue1Shared";
import { worldOf } from "./Blue1Terrain";

/**
 * THE DROP PLAINS' ambient life.
 *
 * - **The Migration Line**: the moving centrepiece. A permanent broad
 *   river of silver fish crossing the whole region mid-water on one
 *   closed line — across the steppe, between the stones, out over the
 *   World's Edge (where the river itself dips toward the deep) and home
 *   along the far prairie. Fish fill the entire loop nose to tail, so
 *   from anywhere on the steppe the band is a glinting thread in the
 *   fog, and up close it is a wall of moving silver.
 * - **The Grey Pilgrim**: a lone ray gliding the steppe on a slow seeded
 *   ellipse, banking into its turns — the sparse wanderer the vastness
 *   needs for scale.
 * - **The grass sprites**: a hover-shoal of pale aqua fry quivering among
 *   the blades by the Sisters, and a travelling wisp over the north
 *   swells.
 * - **Floor fauna**: cobalt cushion stars on the swards, banded whelk
 *   shells along the terrace lips — the bowl's idioms wearing this
 *   region's paint (tips lit, undersides violet, nothing near black).
 * - **The motes**: four hundred pale pinpricks, because empty water needs
 *   something to measure itself against.
 *
 * Everything draws from `SEED ^` substreams at build; the update phase
 * spends no randomness, so a capture's settle is deterministic.
 */

const SEED = SEEDS.regionBlue1;

export interface Blue1LifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

export function buildBlue1Life(): Blue1LifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];

  const river = buildMigrationLine();
  meshes.push(river.mesh, river.glint);
  updaters.push(river.update);

  const ray = buildPilgrim();
  meshes.push(ray.mesh);
  updaters.push(ray.update);

  const sprites = buildSprites();
  meshes.push(sprites.mesh);
  updaters.push(sprites.update);

  meshes.push(buildStars(), buildWhelks());

  const motes = buildMotes();
  meshes.push(motes.points);
  updaters.push(motes.update);

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

// ─── The Migration Line ──────────────────────────────────────────────────────

/** The river's stations: (u, v, lift over the local floor). */
const RIVER_STATIONS: readonly [number, number, number][] = [
  [310, -95, 9],
  [352, -40, 10],
  [400, 8, 11],
  [448, 52, 11],
  [492, 78, 10],
  [530, 48, 9],
  [552, 8, 8],
  [556, -38, 10],
  [528, -78, 9],
  [486, -108, 9],
  [430, -122, 9],
  [372, -118, 9],
];

function buildMigrationLine(): {
  mesh: InstancedMesh;
  glint: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x1a5e);
  const points: Vector3[] = [];
  for (const [u, v, lift] of RIVER_STATIONS) {
    const { x, z } = worldOf(u, v);
    // Over the drop the floor is forty metres down; the clamp bends the
    // river into a dive there instead of letting it ride the void's
    // ceiling — the pour over the edge is the loop's showpiece.
    const y = Math.max(-30, Math.min(-4, seabedHeight(x, z) + lift + random.signed(0.6)));
    points.push(new Vector3(x, y, z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  // Round 5: 300 over the ~700 m loop left the pose's stretch of river
  // reading as "several fish"; 420 closes the nose-to-tail gaps.
  const count = 420;
  const geometry = createFishGeometry({
    width: 0.8,
    height: 0.95,
    length: 1.2,
    tailTaper: 0.52,
    dorsal: 0.35,
    pectoral: 0.7,
    tail: { reach: 1.5, lobe: 0.6, notch: 1.05 },
  });
  // The river must sit above the water's value at forty metres (the
  // pilot's measured lesson): bright blue-silver with a cool emissive.
  // Round 4: intensity up — at 0.85 the fill-plan audit measured the
  // 300-fish river as "~10 mauve specks in empty water".
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x4a7a92,
    emissiveIntensity: 1.15,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "blue1-migration-line";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const silver = new Color(0xe2f2f6);
  const tint = new Color();
  const offsets: { along: number; lateral: number; rise: number; phase: number; scale: number }[] =
    [];
  for (let i = 0; i < count; i++) {
    offsets.push({
      // The whole loop is occupied: a migration, not a school. Round 4
      // tightened the braid (2.1 → 1.4 lateral) and raised the fish
      // (1.15–1.7 → 1.5–2.2) so the band reads as one silver thread from
      // across the steppe instead of dissolving into specks.
      along: i / count + random.signed(0.0012),
      lateral: random.signed(1.4),
      rise: random.signed(0.8),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(1.5, 2.2),
    });
    tint.copy(silver).multiplyScalar(random.range(0.85, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.0021) % 1;
    for (const [i, o] of offsets.entries()) {
      const s = (((head + o.along) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.003) % 1, ahead);
      side.subVectors(ahead, at).cross(up).normalize();
      // The braid: every fish rides a little off the line, swinging with
      // its neighbours so the band's edges ripple like a current.
      const swing = Math.sin(time * calm * 1.5 + i * 0.37 + o.phase * 0.2) * 0.5;
      at.addScaledVector(side, o.lateral + swing);
      at.y += o.rise + Math.sin(time * calm * 1.1 + i * 0.23) * 0.3;
      dummy.position.copy(at);
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);

  // The glint: a static thread of pale additive sparks along the river's
  // own line, unfogged, so the band reads from the far side of the steppe
  // the way a river reads from a hill — the fish carry the close view.
  // Round 4: doubled and enlarged — the audit's measured ask for a band
  // that reads as a silver thread from anywhere on the steppe.
  const glintCount = 400;
  const glintPositions = new Float32Array(glintCount * 3);
  const glintAt = new Vector3();
  for (let i = 0; i < glintCount; i++) {
    path.getPointAt(i / glintCount, glintAt);
    glintPositions[i * 3] = glintAt.x + random.signed(1.4);
    glintPositions[i * 3 + 1] = glintAt.y + random.signed(0.8);
    glintPositions[i * 3 + 2] = glintAt.z + random.signed(1.4);
  }
  const glintGeometry = new BufferGeometry();
  glintGeometry.setAttribute("position", new BufferAttribute(glintPositions, 3));
  glintGeometry.computeBoundingSphere();
  const glint = new Points(
    glintGeometry,
    new PointsMaterial({
      color: 0xd9eef8,
      size: 0.4,
      map: moteTexture(),
      transparent: true,
      opacity: 0.46,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      fog: false,
    }),
  );
  glint.name = "blue1-migration-glint";

  return { mesh, glint, update };
}

// ─── The Grey Pilgrim ────────────────────────────────────────────────────────

/** A drawn ray: diamond body, swept wings, long tail — one silhouette. */
function rayGeometry(): BufferGeometry {
  // Half-profile rows: (along, halfSpan, lift) from nose (0) to tail root.
  const rows: readonly [number, number, number][] = [
    [0, 0.08, 0.05],
    [0.35, 0.75, 0.14],
    [0.85, 1.55, 0.02],
    [1.45, 1.05, -0.06],
    [1.95, 0.28, -0.02],
    [2.2, 0.08, 0],
  ];
  const positions: number[] = [];
  const push = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    side: number,
  ): void => {
    // Two triangles per row pair per side: spine to wingtip.
    positions.push(
      0.0, a[2] + 0.1, -a[0],
      side * a[1], a[2] * 0.3, -a[0] * 1.0 - a[1] * 0.42,
      0.0, b[2] + 0.1, -b[0],
      side * a[1], a[2] * 0.3, -a[0] - a[1] * 0.42,
      side * b[1], b[2] * 0.3, -b[0] - b[1] * 0.42,
      0.0, b[2] + 0.1, -b[0],
    );
  };
  for (let i = 0; i < rows.length - 1; i++) {
    for (const side of [-1, 1]) {
      push(rows[i]!, rows[i + 1]!, side);
    }
  }
  // The tail whip.
  positions.push(0, 0.1, -2.2, 0.03, 0.06, -3.3, -0.03, 0.06, -3.3);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));

  // Paint: slate-blue back paling to the wingtips, a violet under-shadow
  // near the spine — the darkest mark on the animal is a colour.
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const back = new Color(0x5d7590);
  const tipC = new Color(0xaec4cc);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const span = Math.abs(position.getX(i)) / 1.55;
    shade.copy(back).lerp(tipC, smoothstep01((span - 0.2) / 0.7));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  // Face normals first — the geometry is drawn from bare positions and
  // `smoothNormals` only rewrites an attribute that already exists. A lit
  // mesh with no normal array bound was the Ferryman's frame-corrupting
  // driver bug; the same trap was waiting here.
  geometry.computeVertexNormals();
  smoothNormals(geometry);
  geometry.computeBoundingSphere();
  return geometry;
}

function buildPilgrim(): {
  mesh: Mesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x9a7e);
  const geometry = rayGeometry();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x24343c,
    emissiveIntensity: 0.45,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "blue1-pilgrim-ray";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.scale.setScalar(2.3);

  const centerU = 408;
  const centerV = 34;
  const radiusU = 92;
  const radiusV = 66;
  const phase = random.range(0, Math.PI * 2);

  const update = (_dt: number, time: number, calm: number): void => {
    const a = phase + time * calm * 0.03 * Math.PI * 2;
    const u = centerU + Math.cos(a) * radiusU;
    const v = centerV + Math.sin(a) * radiusV;
    const { x, z } = worldOf(u, v);
    const { x: nx, z: nz } = worldOf(
      centerU + Math.cos(a + 0.02) * radiusU,
      centerV + Math.sin(a + 0.02) * radiusV,
    );
    const y = seabedHeight(x, z) + 4.6 + Math.sin(time * calm * 0.24 + phase) * 1.1;
    mesh.position.set(x, y, z);
    mesh.rotation.set(
      Math.sin(time * calm * 0.5 + phase) * 0.05,
      Math.atan2(nx - x, nz - z),
      // The bank: a glider leans into its own turn.
      0.26 + Math.sin(time * calm * 0.31) * 0.08,
    );
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The grass sprites ───────────────────────────────────────────────────────

function buildSprites(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x5f21);
  const count = 46;
  const geometry = createFishGeometry({
    width: 1.0,
    height: 1.2,
    length: 0.8,
    tailTaper: 0.5,
    dorsal: 0.7,
    pectoral: 1.0,
    tail: { reach: 1.3, lobe: 0.7, notch: 1.0 },
  });
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x274a44,
    emissiveIntensity: 0.5,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "blue1-grass-sprites";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const aqua = new Color(0x9fd4c4);
  const tint = new Color();
  const homes: { u: number; v: number; a: number; r: number; h: number; phase: number; scale: number }[] =
    [];
  for (let i = 0; i < count; i++) {
    // Two haunts: the Sisters' hollow and the north swells.
    const sisters = i % 2 === 0;
    homes.push({
      u: sisters ? 468 : 372,
      v: sisters ? -48 : 74,
      a: random.range(0, Math.PI * 2),
      r: random.range(0.25, 1),
      h: random.signed(1),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.55, 0.85),
    });
    tint.copy(aqua).multiplyScalar(random.range(0.85, 1.15));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const update = (_dt: number, time: number, calm: number): void => {
    for (const [i, o] of homes.entries()) {
      const a = o.a + time * calm * 0.13 * (0.6 + o.r * 0.8);
      const spread = 6.5 * (0.3 + o.r * 0.7);
      const { x: cx, z: cz } = worldOf(o.u, o.v);
      const x = cx + Math.cos(a) * spread + Math.sin(time * calm * 0.9 + o.phase) * 0.3;
      const z = cz + Math.sin(a) * spread + Math.cos(time * calm * 1.1 + o.phase) * 0.3;
      const y =
        seabedHeight(x, z) + 2.1 + o.h * 1.1 + Math.sin(time * calm * 0.7 + o.phase) * 0.4;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, a + Math.PI / 2, 0);
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

/** A five-lobed cushion star, domed, tips lifted. Exported for the fill:
 *  the terrace deep-star variant reuses the drawing with its own paint. */
export function starGeometry(): BufferGeometry {
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
  // Tip light against a deeper disc — and the disc's dark leans violet, so
  // the smallest animal on the sand keeps the region's value key.
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.5;
    const tip = smoothstep01((r - 0.3) / 0.6);
    colors[i * 3] = 0.66 + tip * 0.5;
    colors[i * 3 + 1] = 0.6 + tip * 0.52;
    colors[i * 3 + 2] = 0.78 + tip * 0.4;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

function buildStars(): InstancedMesh {
  const random = new Random(SEED ^ 0x57aa);
  const geometry = starGeometry();
  const material = createToonMaterial({ vertexColors: true });
  const count = 26;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "blue1-steppe-stars";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const palette = [0x3a6ea8, 0x7a5f9e, 0x3f8f86];
  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // The first seven are the secret: a deliberate ring of pale gold
    // stars at the Fallen King's foot, under the thin beam — treasure
    // for whoever swims around the wrong side of a dead stone.
    const ringed = i < 7;
    const angle = ringed ? (i / 7) * Math.PI * 2 : random.range(0, Math.PI * 2);
    const u = ringed ? 383.8 + Math.cos(angle) * 1.7 : 320 + random.next() * 200;
    const v = ringed ? -102.2 + Math.sin(angle) * 1.7 : random.signed(110);
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(ringed ? 0.9 : random.range(0.8, 1.7));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (ringed) {
      tint.setHex(0xcbb96a).multiplyScalar(random.range(0.95, 1.1));
    } else {
      tint.setHex(palette[i % palette.length]!).multiplyScalar(random.range(0.85, 1.15));
    }
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** A banded whelk: two stacked cones with a spiral of painted bands.
 *  Exported for the fill: the collar trios wear the same shell. */
export function whelkGeometry(): BufferGeometry {
  const body = new ConeGeometry(0.16, 0.24, 9).toNonIndexed();
  body.translate(0, 0.12, 0);
  const spire = new ConeGeometry(0.09, 0.18, 8).toNonIndexed();
  spire.translate(0.045, 0.3, 0);
  const merged = mergeGeometries([body, spire], false);
  body.dispose();
  spire.dispose();
  if (!merged) {
    throw new Error("blue1 whelk parts could not be merged");
  }
  smoothNormals(merged);
  // The bands: cream and mauve-blue chasing each other up the shell.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const cream = new Color(0xd8cfb8);
  const mauve = new Color(0x77689a);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const angle = Math.atan2(position.getZ(i), position.getX(i));
    const band = 0.5 + 0.5 * Math.sin(y * 26 + angle * 1.0);
    shade.copy(mauve).lerp(cream, smoothstep01((band - 0.35) / 0.3));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

function buildWhelks(): InstancedMesh {
  const random = new Random(SEED ^ 0x0bce);
  const geometry = whelkGeometry();
  const material = createToonMaterial({ vertexColors: true });
  const count = 20;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "blue1-whelks";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // Along the terrace lips and around stone feet, in loose threes.
    const u = 460 + random.next() * 90;
    const v = random.signed(120);
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.03, z);
    dummy.rotation.set(random.signed(0.3), random.range(0, Math.PI * 2), random.signed(0.3));
    dummy.scale.setScalar(random.range(0.8, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setScalar(random.range(0.85, 1.12));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

// ─── The motes ───────────────────────────────────────────────────────────────

let moteSprite: DataTexture | undefined;
function moteTexture(): DataTexture {
  moteSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.2);
    return [halo * 0.82, halo * 0.94, halo];
  });
  return moteSprite;
}

function buildMotes(): {
  points: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x40ef);
  const count = 420;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = random.range(80, 590);
    const v = u < 290 ? random.signed(16) : random.signed(140);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + random.range(0.6, 12);
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
    size: 0.08,
    map: moteTexture(),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "blue1-motes";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.1 + p) * 1.7 + t * 0.05 * Math.sin(p);
        live[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.06 + p * 1.7) * 1.0;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.08 + p) * 1.7;
      }
      attribute.needsUpdate = true;
    },
  };
}
