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
  LatheGeometry,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector2,
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
import { EMBER, smoothstep01 } from "./SmokingShared";
import type { ChimneyStand } from "./SmokingChimneys";
import { CALDERA, SPRINGS, worldOf } from "./SmokingTerrain";

/**
 * The Smoulder Fields' ambient life:
 *
 * - **Heat-drift**: six hundred ember motes (one additive `Points` draw)
 *   riding thermals upward through the whole province — the region is
 *   always breathing out.
 * - **The thermal riders**: the shoal behaviour this region owns. A
 *   ribbon of pale-copper fish follows one closed line that spirals 2.3
 *   turns up the Twin Kings' smoke column, glides off the crown and
 *   sinks back down the forest's edge — riding the heat up, the water
 *   down, forever.
 * - **The jelly procession**: the moving centrepiece. Nine great thermal
 *   jellies rise in single file from the Old Kiln at the caldera's
 *   centre, bells pulsing, drift off the top of the haze and sink back
 *   along the bowl's far wall — a slow lantern-parade the fog reveals
 *   one jelly at a time.
 * - **Floor fauna** (the Wave 8 idioms, repainted for heat): cinder
 *   stars — violet-charcoal cushion stars whose lobe-tips hold embers —
 *   and ember urchins, maroon domes with amber-tipped spines.
 *
 * Everything draws from `SEED ^` substreams at build; the update phase
 * spends no randomness, so a capture's settle is deterministic.
 */

const SEED = SEEDS.regionSmoking1;

export interface SmokingLifeBuild {
  readonly meshes: (Mesh | Points | InstancedMesh)[];
  update(dt: number, time: number, reducedMotion: boolean): void;
}

export function buildSmokingLife(kings: readonly ChimneyStand[]): SmokingLifeBuild {
  const meshes: (Mesh | Points | InstancedMesh)[] = [];
  const updaters: ((dt: number, time: number, calm: number) => void)[] = [];

  const motes = buildEmberMotes();
  meshes.push(motes.points);
  updaters.push(motes.update);

  const riders = buildThermalRiders(kings);
  meshes.push(riders.mesh);
  updaters.push(riders.update);

  const jellies = buildJellyProcession();
  meshes.push(jellies.mesh);
  updaters.push(jellies.update);

  meshes.push(buildCinderStars(), buildEmberUrchins());

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

// ─── The heat-drift ──────────────────────────────────────────────────────────

let emberSprite: DataTexture | undefined;
function emberTexture(): DataTexture {
  emberSprite ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.2);
    return [halo, halo * 0.62, halo * 0.3];
  });
  return emberSprite;
}

function buildEmberMotes(): {
  points: Points;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0xe40e);
  const count = 600;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const spans = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Thicker over the chimney forest and caldera, thinner down the gorge.
    const nearHeat = random.next() < 0.62;
    const u = nearHeat ? 440 + random.signed(130) : random.range(90, 560);
    const v = u < 292 ? random.signed(14) : random.signed(130);
    const { x, z } = worldOf(u, v);
    const floor = seabedHeight(x, z);
    base[i * 3] = x;
    base[i * 3 + 1] = floor + 0.4;
    base[i * 3 + 2] = z;
    phases[i] = random.range(0, 1);
    spans[i] = random.range(5, 14);
  }
  live.set(base);

  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(live, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    size: 0.1,
    map: emberTexture(),
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.name = "smoulder-ember-motes";
  points.frustumCulled = false;

  return {
    points,
    update(_dt: number, time: number, calm: number): void {
      const t = time * calm;
      for (let i = 0; i < count; i++) {
        const p = phases[i]!;
        // Heat rises: each mote climbs its own short column and re-seeds.
        const cycle = (p + t * 0.02) % 1;
        live[i * 3] = base[i * 3]! + Math.sin(t * 0.1 + p * 37) * (0.8 + cycle * 1.6);
        live[i * 3 + 1] = base[i * 3 + 1]! + cycle * spans[i]!;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.08 + p * 53) * (0.8 + cycle * 1.6);
      }
      attribute.needsUpdate = true;
    },
  };
}

// ─── The thermal riders ──────────────────────────────────────────────────────

function buildThermalRiders(kings: readonly ChimneyStand[]): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x50a1);

  // The column the shoal rides: the midpoint of the Twin Kings.
  const a = kings[0]!;
  const b = kings[1]!;
  const cx = (a.x + b.x) / 2;
  const cz = (a.z + b.z) / 2;
  const floor = (a.y + b.y) / 2;
  const top = floor + Math.max(a.height, b.height) + 4;

  // The closed line: 2.3 turns spiralling up the column, a glide off the
  // crown, a long sink down the forest's edge, and a low run home.
  const points: Vector3[] = [];
  const turns = 2.3;
  const rise = top - (floor + 2.5);
  for (let i = 0; i <= 11; i++) {
    const t = i / 11;
    const theta = t * turns * Math.PI * 2;
    const r = 7.5 - t * 2.2;
    points.push(
      new Vector3(
        cx + Math.cos(theta) * r,
        floor + 2.5 + t * rise,
        cz + Math.sin(theta) * r,
      ),
    );
  }
  // Off the crown and down the cold side.
  const away = worldOf(CALDERA.u - 38, -8);
  const awayY = seabedHeight(away.x, away.z);
  points.push(new Vector3(cx + 12, top + 2, cz + 10));
  points.push(new Vector3(away.x, (top + awayY) / 2 + 2, away.z));
  points.push(new Vector3(away.x - 8, awayY + 3, away.z - 6));
  points.push(new Vector3(cx - 14, floor + 2.2, cz - 8));
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 64;
  const geometry = createFishGeometry({
    width: 0.9,
    height: 1.0,
    length: 1.0,
    tailTaper: 0.52,
    dorsal: 0.5,
    pectoral: 0.85,
    tail: { reach: 1.45, lobe: 0.62, notch: 1.0 },
  });
  // Pale copper, held ABOVE the water's value (the pilot's round-8
  // lesson): a dim fish on a saturated warm field reads as its
  // complement, so the ribbon is bright on purpose.
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x8a5a38,
    emissiveIntensity: 0.75,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "smoulder-thermal-riders";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const copper = new Color(0xf2d5b4);
  const tint = new Color();
  const offsets: { lateral: number; phase: number; scale: number }[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push({
      lateral: random.signed(0.5),
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.85, 1.25),
    });
    tint.copy(copper).multiplyScalar(random.range(0.85, 1.05));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const bodySpan = 0.3;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.014) % 1;
    for (const [i, o] of offsets.entries()) {
      const s = (((head - (i / count) * bodySpan) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.004) % 1, ahead);
      side.subVectors(ahead, at).cross(up).normalize();
      const swing = Math.sin(time * calm * 1.6 + i * 0.35 + o.phase * 0.2) * 0.3;
      at.addScaledVector(side, o.lateral + swing);
      at.y += Math.sin(time * calm * 1.2 + i * 0.24) * 0.24;
      dummy.position.copy(at);
      const pitch = Math.atan2(
        ahead.y - at.y,
        Math.hypot(ahead.x - at.x, ahead.z - at.z),
      );
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.rotateX(-pitch * 0.8);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The jelly procession ────────────────────────────────────────────────────

/** The bell: a soft dome with a turned-in lip and a warm heart. */
function jellyGeometry(): BufferGeometry {
  const profile: Vector2[] = [
    new Vector2(0, 0.52),
    new Vector2(0.3, 0.5),
    new Vector2(0.55, 0.4),
    new Vector2(0.72, 0.22),
    new Vector2(0.78, 0),
    new Vector2(0.72, -0.12),
    new Vector2(0.6, -0.06),
    new Vector2(0.42, -0.1),
  ];
  const bell = new LatheGeometry(profile, 14);
  smoothNormals(bell);

  // Six short skirt straps, splayed outward — round 2's four parallel
  // straps merged into one thick stalk and the jelly read as a mushroom.
  const parts: BufferGeometry[] = [bell.toNonIndexed()];
  for (let i = 0; i < 6; i++) {
    const strap = new PlaneGeometry(0.11, 0.85, 1, 4).toNonIndexed();
    strap.translate(0, -0.5, 0);
    strap.applyMatrix4(new Matrix4().makeRotationZ(0.35));
    const theta = (i / 6) * Math.PI * 2 + 0.4;
    strap.applyMatrix4(new Matrix4().makeTranslation(0.42, -0.05, 0).premultiply(new Matrix4().makeRotationY(theta)));
    parts.push(strap);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("smoulder jelly parts could not be merged");
  }

  // The paint: rose-amber bell, palest at the crown, a warm heart under
  // the dome, skirt fading toward violet — a floating lantern.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const crown = new Color(0xf6d9c2);
  const heart = new Color(0xf09a5c);
  const skirt = new Color(0x9a7290);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y >= -0.15) {
      shade.copy(heart).lerp(crown, smoothstep01((y + 0.15) / 0.65));
    } else {
      shade.copy(heart).lerp(skirt, smoothstep01((-y - 0.15) / 1.2));
    }
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

function buildJellyProcession(): {
  mesh: InstancedMesh;
  update: (dt: number, time: number, calm: number) => void;
} {
  const random = new Random(SEED ^ 0x9e11);

  // The file: up from the Old Kiln, a drift across the haze's top, a
  // long sink down the caldera's far wall, and a crawl back along the
  // floor — one closed loop, single file by construction.
  const kiln = worldOf(CALDERA.u, CALDERA.v);
  const kilnY = seabedHeight(kiln.x, kiln.z);
  const west = worldOf(CALDERA.u - 26, CALDERA.v + 18);
  const east = worldOf(CALDERA.u + 24, CALDERA.v - 12);
  const points: Vector3[] = [
    new Vector3(kiln.x, kilnY + 4, kiln.z),
    new Vector3(kiln.x + 3, kilnY + 12, kiln.z + 2),
    new Vector3(kiln.x - 2, kilnY + 20, kiln.z + 5),
    new Vector3(west.x, kilnY + 26, west.z),
    new Vector3(west.x - 8, kilnY + 18, west.z + 4),
    new Vector3(west.x - 4, kilnY + 8, west.z - 6),
    new Vector3(east.x, kilnY + 5, east.z),
    new Vector3(east.x - 8, kilnY + 2.5, east.z + 4),
  ];
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 9;
  const mesh = new InstancedMesh(jellyGeometry(), createToonMaterial({
    vertexColors: true,
    emissive: 0xe8874a,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.9,
  }), count);
  mesh.name = "smoulder-jelly-procession";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const tint = new Color();
  const phases: number[] = [];
  const scales: number[] = [];
  for (let i = 0; i < count; i++) {
    phases.push(random.range(0, Math.PI * 2));
    scales.push(random.range(1.7, 2.6));
    tint.setScalar(random.range(0.9, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();

  const update = (_dt: number, time: number, calm: number): void => {
    const head = (time * calm * 0.006) % 1;
    for (let i = 0; i < count; i++) {
      const s = (((head - i / count) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.01) % 1, ahead);
      const pulse = 1 + Math.sin(time * calm * 0.9 + phases[i]!) * 0.1;
      dummy.position.copy(at);
      dummy.position.y += Math.sin(time * calm * 0.5 + phases[i]!) * 0.4;
      dummy.rotation.set(
        (ahead.z - at.z) * 0.04,
        phases[i]!,
        -(ahead.x - at.x) * 0.04,
      );
      dummy.scale.set(scales[i]! * (2 - pulse), scales[i]! * pulse, scales[i]! * (2 - pulse));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0, 0, 1);
  return { mesh, update };
}

// ─── The floor fauna ─────────────────────────────────────────────────────────

/** A five-lobed cushion star, domed, tips lifted — the bowl's idiom. */
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

/**
 * Cinder stars: the cushion star repainted for this region — a violet-
 * charcoal disc whose lobe-tips hold live embers. The tip bake is the
 * improvement: the pilot's stars carried value only; these carry heat,
 * and the vein-glow material makes the tips the brightest smallwork on
 * the floor.
 */
function buildCinderStars(): InstancedMesh {
  const random = new Random(SEED ^ 0x57a7);
  const geometry = starGeometry();
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const body = new Color(0x5e4a66);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.5;
    const tip = smoothstep01((r - 0.55) / 0.4);
    shade.copy(body).multiplyScalar(0.85 + r * 0.3).lerp(EMBER, tip * 0.85);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xff7a38,
    emissiveIntensity: 0.3,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;`,
    );
  };
  material.customProgramCacheKey = () => "smoulder-cinder-star";

  const count = 24;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "smoulder-cinder-stars";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // On the flats and around the spring terraces' pale ground.
    const nearSprings = random.next() < 0.4;
    const u = nearSprings ? SPRINGS.u + random.signed(30) : 300 + random.next() * 130;
    const v = nearSprings ? SPRINGS.v + random.signed(30) : random.signed(85);
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.8, 1.6));
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

/** An ember urchin: maroon dome, a whorl of amber-tipped spines. */
function urchinGeometry(): BufferGeometry {
  const body = new IcosahedronGeometry(0.14, 1);
  body.scale(1, 0.75, 1);
  const bodyColors = new Float32Array((body.attributes.position!.count ?? 0) * 3);
  const maroon = new Color(0x6b3c48);
  for (let i = 0; i < bodyColors.length / 3; i++) {
    bodyColors[i * 3] = maroon.r;
    bodyColors[i * 3 + 1] = maroon.g;
    bodyColors[i * 3 + 2] = maroon.b;
  }
  body.setAttribute("color", new BufferAttribute(bodyColors, 3));

  const parts: BufferGeometry[] = [body];
  const spikeRandom = new Random(SEED ^ 0x0bc7);
  const spineBase = new Color(0x7a4a50);
  const spineTip = new Color(0xffa050);
  for (let i = 0; i < 16; i++) {
    const spike = new ConeGeometry(0.018, 0.3, 3).toNonIndexed();
    spike.translate(0, 0.15, 0);
    const position = spike.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let k = 0; k < position.count; k++) {
      const t = smoothstep01(position.getY(k) / 0.3);
      shade.copy(spineBase).lerp(spineTip, t * t);
      colors[k * 3] = shade.r;
      colors[k * 3 + 1] = shade.g;
      colors[k * 3 + 2] = shade.b;
    }
    spike.setAttribute("color", new BufferAttribute(colors, 3));
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
    throw new Error("smoulder urchin parts could not be merged");
  }
  return merged;
}

function buildEmberUrchins(): InstancedMesh {
  const random = new Random(SEED ^ 0x0bc8);
  const geometry = urchinGeometry();
  const material = createToonMaterial({ vertexColors: true });
  const count = 18;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "smoulder-ember-urchins";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    // The chimney forest's warm floor, clustered near the vents.
    const { x, z } = worldOf(470 + random.next() * 80, -90 + random.next() * 70);
    dummy.position.set(x, seabedHeight(x, z) + 0.04, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(0.8, 1.7));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setScalar(random.range(0.85, 1.1));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}
