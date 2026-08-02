import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector3,
  type Camera,
  type DataTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildFallSheets, buildFallStreakTexture, type FallSheetSpec } from "../kit/FallStreak";
import { smoothstep01 } from "./Verdant2Shared";
import { MISTFALL, mistfallLipU, worldOf } from "./Verdant2Terrain";

/**
 * THE MISTFALL — the region's landmark and its second light peak (fill
 * plan §4): a slow waterfall of silt pouring over the great terrace lip
 * into the basin, REBUILT as a light event.
 *
 * Four marks, all deterministic:
 *
 * - **The milk** (kit `fallStreak`): overlapping soft-edged tapered
 *   sheets wearing the kit's tiling column texture — per-column width
 *   and phase jitter, alpha-dissolved tops AND feet, a slow closed-form
 *   scroll. This replaces the old pair of hard-topped quad curtains
 *   whose rectangular heads the audit called out in `mistfall-above`.
 *   The sheets are `fog:false` additive, so the region adds the fourth
 *   light-discipline part the kit leaves to the caller: a camera-range
 *   fade (full to 100 m, dead by 180 — longer than ordinary marks
 *   because this is a named light peak, plan §4).
 * - **The grains**: the falling silt motes, grown ×1.5 (320 → 480).
 * - **The billows**: the soft milk clouds where the fall lands, kept.
 * - **THE BILLOW GLOW FAN** (exclusive, §6b.2): an additive fan of
 *   ground-faded light blades leaning out of the pour's foot — the
 *   wet-light of the falls, the event the audit found missing below.
 */

const SEED = SEEDS.regionVerdant2;

/** The fall's plan-space band, shared with the terrain's silt-fan paint. */
const FALL_HALF_WIDTH = 13;
const LIP_Y = -30.6;
const FOOT_Y = -45.2;

/**
 * The cliff edge at the fall's own `v` — round 1 placed the curtains at
 * a fixed `MISTFALL.u` while the authored lip meanders ~7 m downstream
 * there, which buried the fall inside its own cliff.
 */
const LIP_BASE_U = mistfallLipU(MISTFALL.v);

/** The milk's range fade: a light peak carries further than ordinary marks. */
const MILK_FADE_FROM = 100;
const MILK_FADE_TO = 180;

export interface MistfallBuild {
  readonly meshes: (Mesh | Points)[];
  update(dt: number, reducedMotion: boolean): void;
}

export function buildMistfall(): MistfallBuild {
  const random = new Random(SEED ^ 0x30a8);
  const meshes: (Mesh | Points)[] = [];

  // ─── The milk (kit fallStreak) ───────────────────────────────────────────
  // Seven overlapping sheets across the fall's width, staggered down the
  // lip's own meander, widths and heights jittered so no two share an
  // edge. One merged draw, one shared texture.
  const milkTexture = buildFallStreakTexture({ seed: SEED ^ 0xf902, columns: 6, softness: 0.6 });
  const spineA = worldOf(0, 0);
  const spineB = worldOf(1, 0);
  const downhillYaw = Math.atan2(spineB.x - spineA.x, spineB.z - spineA.z);
  const sheetRandom = new Random(SEED ^ 0xf901);
  const sheets: FallSheetSpec[] = [];
  for (let i = 0; i < 7; i++) {
    const v = MISTFALL.v + (i - 3) * 3.4 + sheetRandom.signed(1.2);
    const belly = 0.8 + sheetRandom.range(0, 2.6);
    const { x, z } = worldOf(mistfallLipU(v) + belly, v);
    sheets.push({
      pos: [x, FOOT_Y - 0.6, z],
      width: sheetRandom.range(5.5, 8.5),
      height: LIP_Y - FOOT_Y + sheetRandom.range(1.0, 2.6),
      phase: sheetRandom.next(),
      facing: downhillYaw,
    });
  }
  const milk = buildFallSheets({
    seed: SEED ^ 0xf903,
    texture: milkTexture,
    tint: 0xd9ecd2,
    sheets,
    opacity: 0.19,
  });
  const milkMesh = milk.group.getObjectByName("kit-fall-sheets") as Mesh;
  const milkMaterial = milkMesh.material as MeshBasicMaterial;
  const milkBaseOpacity = milkMaterial.opacity;
  const milkCentre = (() => {
    const { x, z } = worldOf(LIP_BASE_U + 2, MISTFALL.v);
    return new Vector3(x, (LIP_Y + FOOT_Y) / 2, z);
  })();
  milkMesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
    const distance = milkCentre.distanceTo(camera.position);
    milkMaterial.opacity =
      milkBaseOpacity * (1 - smoothstep01((distance - MILK_FADE_FROM) / (MILK_FADE_TO - MILK_FADE_FROM)));
  };
  meshes.push(milkMesh);

  // ─── The grains ──────────────────────────────────────────────────────────
  const count = 480;
  const base = new Float32Array(count * 3);
  const live = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const v = MISTFALL.v + random.signed(FALL_HALF_WIDTH * 0.9);
    const u = mistfallLipU(v) + random.range(0.2, 4);
    const { x, z } = worldOf(u, v);
    base[i * 3] = x;
    base[i * 3 + 1] = 0;
    base[i * 3 + 2] = z;
    phases[i] = random.next();
    speeds[i] = random.range(1.6, 3.2);
  }
  live.set(base);
  const grainGeometry = new BufferGeometry();
  const grainAttribute = new BufferAttribute(live, 3);
  grainAttribute.setUsage(DynamicDrawUsage);
  grainGeometry.setAttribute("position", grainAttribute);
  grainGeometry.computeBoundingSphere();
  const lipWorld = worldOf(LIP_BASE_U + 3, MISTFALL.v);
  grainGeometry.boundingSphere!.center.set(lipWorld.x, (LIP_Y + FOOT_Y) / 2, lipWorld.z);
  grainGeometry.boundingSphere!.radius = 30;

  const grains = new Points(
    grainGeometry,
    new PointsMaterial({
      size: 0.14,
      map: grainTexture(),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  grains.name = "verdant2-mistfall-grains";
  grains.frustumCulled = false;
  meshes.push(grains);

  // ─── The billows ─────────────────────────────────────────────────────────
  // The geometry stays LOCAL and the mesh carries the position: the old
  // build baked world coordinates into the plane and then breathed
  // `mesh.scale`, which scales about the ORIGIN — a kilometre away — so
  // every breath slid the billow tens of metres across the province
  // (round 1's transient white wash over `gardens-vista` was a billow
  // mid-drift, and the r5 "solid violet frame" suspect list missed it).
  const billows: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const geometry = new PlaneGeometry(13 + i * 5, 6 + i * 1.8, 1, 1);
    const at = worldOf(LIP_BASE_U + 7 + i * 5, MISTFALL.v + random.signed(5));
    const y = seabedHeight(at.x, at.z);
    geometry.rotateY(random.range(0, Math.PI));
    geometry.computeBoundingSphere();
    // Round 3: the halo is the ALPHA as well as the colour. A colour-only
    // map under NormalBlending is a uniform-opacity quad whose texels go
    // black at the corners — from inside the basin one billow read as a
    // giant tinted glass pane with straight edges (`mistfall-below` r2).
    // With the same halo as alphaMap the pane dissolves into cloud.
    const material = new MeshBasicMaterial({
      map: billowTexture(),
      alphaMap: billowTexture(),
      color: new Color(0xcfe4c8),
      transparent: true,
      opacity: 0.26 - i * 0.05,
      depthWrite: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(at.x, y + 2.4 + i * 0.9, at.z);
    mesh.name = `verdant2-mistfall-billow-${i}`;
    mesh.renderOrder = 2;
    billows.push(mesh);
    meshes.push(mesh);
  }

  // ─── The billow glow fan (exclusive) ─────────────────────────────────────
  // The wet-light of the falls: five additive blades fanned out of the
  // pour's foot, brightest at the ground and dissolving upward — the
  // fall's landing becomes a light event (light peak #2, plan §4). The
  // fan carries the full four-part discipline: `fog:false`, a baked
  // ground fade, an edge-forgiving radial sprite, and a range fade.
  const fan = buildBillowGlowFan(new Random(SEED ^ 0xf904));
  meshes.push(fan);

  let clock = 0;
  const height = LIP_Y - FOOT_Y;
  return {
    meshes,
    update(dt: number, reducedMotion: boolean): void {
      clock += dt * (reducedMotion ? 0.4 : 1);
      milk.update(clock);
      for (let i = 0; i < count; i++) {
        const t = (phases[i]! + clock * (speeds[i]! / height)) % 1;
        live[i * 3] = base[i * 3]! + Math.sin(clock * 0.4 + i) * 0.3 * t;
        live[i * 3 + 1] = LIP_Y + 1 - t * height;
        live[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(clock * 0.33 + i * 1.7) * 0.3 * t;
      }
      grainAttribute.needsUpdate = true;
      for (const [i, billow] of billows.entries()) {
        const breathe = 1 + Math.sin(clock * 0.22 + i * 2.1) * 0.08;
        billow.scale.set(breathe, 1, breathe);
      }
      fan.scale.setScalar(1 + Math.sin(clock * 0.18) * 0.05);
    },
  };
}

/** The exclusive foot-glow: a radial fan of ground-lit additive blades.
 *  Geometry is LOCAL to the fall's foot and the mesh carries the
 *  position, so the breathing scale breathes in place (see the billow
 *  comment above — scaling world-baked geometry drifts it). */
function buildBillowGlowFan(random: Random): Mesh {
  const parts: BufferGeometry[] = [];
  const footAt = worldOf(LIP_BASE_U + 6.5, MISTFALL.v);
  const footY = seabedHeight(footAt.x, footAt.z);
  for (let i = 0; i < 5; i++) {
    const blade = new PlaneGeometry(random.range(4.5, 7), random.range(3.4, 5.2), 1, 6);
    const position = blade.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const height = 4.2;
    for (let k = 0; k < position.count; k++) {
      // Bright at the foot, dead by the head — the glow hugs the landing.
      const t = position.getY(k) / height + 0.5;
      const value = Math.pow(Math.max(0, 1 - t), 1.6);
      colors[k * 3] = value;
      colors[k * 3 + 1] = value;
      colors[k * 3 + 2] = value * 0.94;
    }
    blade.setAttribute("color", new BufferAttribute(colors, 3));
    // Fanned: leaning outward from the foot, spread across the fall.
    blade.rotateX(random.signed(0.35));
    blade.rotateY((i - 2) * 0.55 + random.signed(0.2));
    const dv = (i - 2) * 4.2 + random.signed(1.5);
    const at = worldOf(LIP_BASE_U + 6 + Math.abs(i - 2) * 1.2, MISTFALL.v + dv);
    blade.translate(
      at.x - footAt.x,
      seabedHeight(at.x, at.z) + 1.6 - footY,
      at.z - footAt.z,
    );
    parts.push(blade);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("verdant2 billow glow fan could not be merged");
  }
  merged.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    map: glowFanTexture(),
    color: new Color(0xe6f4d0),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    vertexColors: true,
    fog: false,
  });
  const mesh = new Mesh(merged, material);
  mesh.position.set(footAt.x, footY, footAt.z);
  mesh.name = "verdant2-mistfall-glow-fan";
  mesh.renderOrder = 3;
  const centre = new Vector3(footAt.x, footY + 2, footAt.z);
  const baseOpacity = material.opacity;
  mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
    const distance = centre.distanceTo(camera.position);
    material.opacity = baseOpacity * (1 - smoothstep01((distance - 70) / 50));
  };
  return mesh;
}

let grainMap: DataTexture | undefined;
function grainTexture(): DataTexture {
  grainMap ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const halo = Math.pow(Math.max(0, 1 - d * d), 2.4);
    return [halo * 0.94, halo, halo * 0.88];
  });
  return grainMap;
}

let billowMap: DataTexture | undefined;
function billowTexture(): DataTexture {
  billowMap ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEED ^ 0x30aa, period: 3, octaves: 2 });
    const d = Math.hypot((u - 0.5) * 1.6, (v - 0.5) * 2.4) * (1.5 + wobble * 0.7);
    const halo = Math.pow(Math.max(0, 1 - d * d), 2);
    return [halo, halo, halo * 0.96];
  });
  return billowMap;
}

let glowFanMap: DataTexture | undefined;
function glowFanTexture(): DataTexture {
  glowFanMap ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEED ^ 0xf905, period: 3, octaves: 2 });
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.6);
    const rise = Math.pow(Math.max(0, 1 - v), 1.4) * (0.8 + wobble * 0.4);
    const value = Math.min(1, bell * rise);
    return [value, value, value * 0.95];
  });
  return glowFanMap;
}
