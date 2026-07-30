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
  RepeatWrapping,
  type DataTexture,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { smoothstep01 } from "./Verdant2Shared";
import { MISTFALL, mistfallLipU, worldOf } from "./Verdant2Terrain";

/**
 * THE MISTFALL — the region's landmark: a slow waterfall of silt pouring
 * over the great terrace lip and down the whole cliff face into the
 * basin's green depth.
 *
 * Three marks, all deterministic:
 *
 * - **The fall**: two overlapped curtain sheets from the lip's crest to
 *   the basin floor, wearing a streaked milk texture whose offset scrolls
 *   slowly downward each frame (time-based — no randomness is ever spent
 *   after build). Normal blending with fog on: the fall is a *thing* in
 *   the water, not a light.
 * - **The grains**: a column of falling silt motes (one additive Points
 *   draw) recycling over the fall's height on the same clock.
 * - **The billow**: soft milk sprites where the fall lands, and a slow
 *   breathing scale on them — the foot of the fall never holds still.
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

export interface MistfallBuild {
  readonly meshes: (Mesh | Points)[];
  update(dt: number, reducedMotion: boolean): void;
}

export function buildMistfall(): MistfallBuild {
  const random = new Random(SEED ^ 0x30a8);
  const meshes: (Mesh | Points)[] = [];

  // ─── The fall's curtains ─────────────────────────────────────────────────
  const curtains: { material: MeshBasicMaterial; rate: number }[] = [];
  for (const [i, spec] of [
    { width: FALL_HALF_WIDTH * 2, lean: 1.6, opacity: 0.5, rate: 0.026 },
    { width: FALL_HALF_WIDTH * 1.5, lean: 2.6, opacity: 0.36, rate: 0.041 },
  ].entries()) {
    const height = LIP_Y - FOOT_Y + 2;
    const geometry = new PlaneGeometry(spec.width, height, 6, 12);
    const position = geometry.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let k = 0; k < position.count; k++) {
      // 0 lip → 1 foot; clamped, because a float hair below zero turns
      // Math.pow(ty, 1.6) into NaN and the bounding sphere with it.
      const ty = Math.min(1, Math.max(0, 0.5 - position.getY(k) / height));
      const tx = position.getX(k) / spec.width;
      // The curtain bellies outward as it falls, like poured cream.
      position.setZ(k, spec.lean * Math.pow(ty, 1.6) + Math.sin(tx * Math.PI * 2 + i) * 0.4 * ty);
      // Round 5: the fades moved into the alpha map — fading the vertex
      // *colour* darkened the sheet's rim to a black line against the
      // fog instead of dissolving it. The colour now carries only a
      // gentle value drop toward the foot.
      const value = 1 - ty * 0.18;
      colors[k * 3] = value;
      colors[k * 3 + 1] = value;
      colors[k * 3 + 2] = value;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    position.needsUpdate = true;
    geometry.computeVertexNormals();

    const map = fallTexture();
    const material = new MeshBasicMaterial({
      map,
      color: new Color(0xd9ecd2),
      transparent: true,
      opacity: spec.opacity,
      depthWrite: false,
      side: DoubleSide,
      vertexColors: true,
      alphaMap: fallAlphaTexture(),
    });
    // Each curtain scrolls its own copy of the texture (the alpha map
    // stays still — the edge fade must not scroll with the milk).
    material.map = map.clone();
    material.map.wrapS = RepeatWrapping;
    material.map.wrapT = RepeatWrapping;
    curtains.push({ material, rate: spec.rate });

    const at = worldOf(LIP_BASE_U + 0.5 + i * 2.2, MISTFALL.v + (i === 0 ? 0 : 1.5));
    geometry.rotateY(-1.35 - Math.PI / 2 + random.signed(0.05));
    geometry.translate(at.x, (LIP_Y + FOOT_Y) / 2 + 1, at.z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = `verdant2-mistfall-curtain-${i}`;
    mesh.renderOrder = 3;
    meshes.push(mesh);
  }

  // ─── The grains ──────────────────────────────────────────────────────────
  const count = 320;
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

  // ─── The billow ──────────────────────────────────────────────────────────
  const billows: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const geometry = new PlaneGeometry(13 + i * 5, 6 + i * 1.8, 1, 1);
    const at = worldOf(LIP_BASE_U + 7 + i * 5, MISTFALL.v + random.signed(5));
    const y = seabedHeight(at.x, at.z);
    geometry.rotateY(random.range(0, Math.PI));
    geometry.translate(at.x, y + 2.4 + i * 0.9, at.z);
    geometry.computeBoundingSphere();
    const material = new MeshBasicMaterial({
      map: billowTexture(),
      color: new Color(0xcfe4c8),
      transparent: true,
      opacity: 0.26 - i * 0.05,
      depthWrite: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `verdant2-mistfall-billow-${i}`;
    mesh.renderOrder = 2;
    billows.push(mesh);
    meshes.push(mesh);
  }

  let clock = 0;
  const height = LIP_Y - FOOT_Y;
  return {
    meshes,
    update(dt: number, reducedMotion: boolean): void {
      clock += dt * (reducedMotion ? 0.4 : 1);
      for (const curtain of curtains) {
        curtain.material.map!.offset.y = (clock * curtain.rate) % 1;
      }
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
    },
  };
}

/**
 * The curtain's alpha: a bell across the sheet, a dissolve at the head
 * (the lip's spill starts thin) and a soft foot into the billow. Plane
 * UVs put v = 1 at the lip.
 */
let fallAlphaMap: DataTexture | undefined;
function fallAlphaTexture(): DataTexture {
  fallAlphaMap ??= buildColorTexture(64, (u, v) => {
    const bell = 1 - smoothstep01((Math.abs(u - 0.5) - 0.28) / 0.2);
    const head = smoothstep01((1 - v) / 0.14);
    const foot = smoothstep01(v / 0.1);
    const a = bell * head * foot;
    return [a, a, a];
  });
  return fallAlphaMap;
}

/** Vertical milk streaks, tileable along the fall. */
let fallMap: DataTexture | undefined;
function fallTexture(): DataTexture {
  fallMap ??= buildColorTexture(128, (u, v) => {
    const streaks =
      0.45 +
      fbm(u * 6, v * 1.2, { seed: SEED ^ 0x30a9, period: 8, octaves: 3 }) * 0.7 +
      Math.sin(u * Math.PI * 26) * 0.06;
    const value = Math.max(0, Math.min(1, streaks));
    return [value, value, value * 0.98];
  });
  return fallMap;
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
