import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { AMBER, SINTER_PALE, smoothstep01 } from "./SmokingShared";
import { SPRINGS, SPRING_STEP, spokeOf, springsStair, springsWeight, worldOf } from "./SmokingTerrain";

/**
 * The Spring Terraces: stacked mineral pools stepping down the stair the
 * terrain benches drew. Three pieces:
 *
 * - **The terrace water**: one sheet whose every vertex rides the same
 *   `springsStair` bench the ground does, lifted 0.3 m — so each tread
 *   holds a flat pool and each riser is a short spill, by construction.
 *   Milky mineral turquoise-white, faded at the pool edges, additive so
 *   it shimmers over the pale floor instead of hiding it.
 * - **The rim beads**: instanced sinter knobs seeded exactly on the rim
 *   bands (the bench fraction the ground paint brightens), so the pale
 *   rims the paint promises have real edges the eye can catch.
 * - **The Spring Head**: the crown mound the whole stair descends from,
 *   its throat amber — the one hot note over the palest ground here.
 */

const SEED = SEEDS.regionSmoking1;

export interface SmokingSpringsBuild {
  readonly meshes: Mesh[];
  readonly instanced: InstancedMesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  update(dt: number): void;
}

const WATER_TINT = new Color(0x9adfd4);

export function buildSmokingSprings(): SmokingSpringsBuild {
  const random = new Random(SEED ^ 0x59a7);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // ─── The terrace water ───────────────────────────────────────────────────
  const span = SPRINGS.radius * 2.1;
  const segments = 64;
  const sheet = new PlaneGeometry(span, span, segments, segments);
  sheet.rotateX(-Math.PI / 2);
  const centerWorld = worldOf(SPRINGS.u, SPRINGS.v);
  const position = sheet.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + centerWorld.x;
    const z = position.getZ(i) + centerWorld.z;
    position.setX(i, x);
    position.setZ(i, z);
    const { u, v } = spokeOf(x, z);
    const { raw, pooled } = springsStair(u, v);
    const w = springsWeight(u, v);
    position.setY(i, pooled + 0.3);
    // Bright over the pool hearts only, dimming at rims and dying with
    // the biome weight — additive, so colour is opacity here. Round 1
    // measured 0.42 as a glowing glacier visible from the gorge lip: an
    // additive sheet over pale ground compounds, so the mark whispers.
    const frac = raw / SPRING_STEP - Math.floor(raw / SPRING_STEP);
    const heart = (1 - smoothstep01((frac - 0.5) / 0.3)) ** 2;
    const glisten =
      0.75 + fbm(x * 0.11, z * 0.11, { seed: SEED ^ 0x91f7, period: 8, octaves: 2 }) * 0.5;
    const own = smoothstep01((w - 0.3) / 0.4);
    shade.copy(WATER_TINT).multiplyScalar(0.12 * heart * glisten * own * own);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  trimByWeight(sheet);
  sheet.setAttribute("color", new BufferAttribute(colors, 3));
  sheet.computeVertexNormals();
  sheet.computeBoundingSphere();

  // `fog: false` is load-bearing (the canyon light-column rule): fog on
  // an additive mark brightens distance instead of closing it — rounds
  // 1–2 read this sheet as a glowing glacier from the gorge lip.
  const waterMaterial = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  const water = new Mesh(sheet, waterMaterial);
  water.name = "smoulder-spring-water";
  water.renderOrder = 1;
  meshes.push(water);

  // ─── The rim beads ───────────────────────────────────────────────────────
  const bead = new IcosahedronGeometry(0.32, 1);
  bead.scale(1.5, 0.7, 1);
  smoothNormals(bead);
  bakeBeadPaint(bead);
  const beadMaterial = createToonMaterial({ vertexColors: true });
  const beadCount = 170;
  const beads = new InstancedMesh(bead, beadMaterial, beadCount);
  beads.name = "smoulder-spring-rims";
  beads.castShadow = false;
  beads.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  let placed = 0;
  let attempts = 0;
  while (placed < beadCount && attempts < 2600) {
    attempts++;
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * (SPRINGS.radius * 0.96);
    const u = SPRINGS.u + Math.cos(angle) * spread;
    const v = SPRINGS.v + Math.sin(angle) * spread;
    if (springsWeight(u, v) < 0.3) {
      continue;
    }
    const { raw } = springsStair(u, v);
    const frac = raw / SPRING_STEP - Math.floor(raw / SPRING_STEP);
    if (frac < 0.66 || frac > 0.95) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) + 0.08, z);
    dummy.rotation.set(random.signed(0.2), random.range(0, Math.PI * 2), random.signed(0.2));
    dummy.scale.setScalar(random.range(1.0, 2.3));
    dummy.updateMatrix();
    beads.setMatrixAt(placed, dummy.matrix);
    tint.copy(SINTER_PALE).multiplyScalar(random.range(0.88, 1.08));
    beads.setColorAt(placed, tint);
    placed++;
  }
  beads.count = placed;
  beads.instanceMatrix.needsUpdate = true;
  if (beads.instanceColor) {
    beads.instanceColor.needsUpdate = true;
  }
  beads.computeBoundingSphere();

  // ─── The Spring Head ─────────────────────────────────────────────────────
  // The crown mound the stair descends from: a low sinter dome with an
  // amber throat, seated on the highest tread.
  const head = springHeadGeometry();
  const headSpot = worldOf(SPRINGS.u, SPRINGS.v);
  const headY = seabedHeight(headSpot.x, headSpot.z);
  head.translate(headSpot.x, headY, headSpot.z);
  head.computeBoundingSphere();
  const headMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xff8c3a,
    emissiveIntensity: 0.3,
  });
  headMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;`,
    );
  };
  headMaterial.customProgramCacheKey = () => "smoulder-spring-head";
  const headMesh = new Mesh(head, headMaterial);
  headMesh.name = "smoulder-spring-head";
  headMesh.castShadow = false;
  headMesh.receiveShadow = false;
  meshes.push(headMesh);
  colliders.push({ center: new Vector3(headSpot.x, headY + 1.1, headSpot.z), radius: 2.2 });
  contacts.push({ x: headSpot.x, z: headSpot.z, radius: 3.6, strength: 0.42 });

  let time = 0;
  return {
    meshes,
    instanced: [beads],
    colliders,
    contacts,
    update(dt: number): void {
      time += dt;
      // The water breathes: the whole sheet's brightness swells slowly,
      // additive opacity being the cheapest shimmer there is.
      waterMaterial.opacity = 0.56 + Math.sin(time * 0.5) * 0.1;
    },
  };
}

/** Drops sheet triangles outside the springs' own ground. */
function trimByWeight(sheet: PlaneGeometry): void {
  const position = sheet.attributes.position!;
  const index = sheet.getIndex();
  if (!index) {
    return;
  }
  const kept: number[] = [];
  const keep = (i: number): boolean => {
    const { u, v } = spokeOf(position.getX(i), position.getZ(i));
    return springsWeight(u, v) > 0.22;
  };
  for (let i = 0; i < index.count; i += 3) {
    if (keep(index.getX(i)) || keep(index.getX(i + 1)) || keep(index.getX(i + 2))) {
      kept.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  }
  sheet.setIndex(kept);
}

/** Sinter bead paint: pale crown, amber-warmed underside. */
function bakeBeadPaint(geometry: BufferGeometry): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01((position.getY(i) + 0.25) / 0.5);
    shade.copy(AMBER).lerp(SINTER_PALE, 0.35 + t * 0.65);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * The Spring Head's dome: a lathe with a sunken throat, sinter-pale with
 * amber veining that the material's vein-glow reads as heat.
 */
function springHeadGeometry(): BufferGeometry {
  const points: Vector2[] = [
    new Vector2(0, 2.05),
    new Vector2(0.55, 2.1),
    new Vector2(1.0, 1.9),
    new Vector2(1.7, 1.4),
    new Vector2(2.4, 0.8),
    new Vector2(3.0, 0.25),
    new Vector2(3.3, -0.3),
    new Vector2(0, -0.3),
  ];
  const geometry = new LatheGeometry(points, 14);
  smoothNormals(geometry);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const r = Math.hypot(x, z);
    const throat = 1 - smoothstep01((r - 0.5) / 0.6);
    const vein = smoothstep01(
      (fbm(Math.atan2(z, x) * 1.4, y * 0.9, { seed: SEED ^ 0x7ea7, period: 4, octaves: 2 }) - 0.58) /
        0.16,
    );
    shade.copy(SINTER_PALE).multiplyScalar(0.72 + y * 0.14);
    shade.lerp(AMBER, Math.min(1, throat * 0.9 + vein * 0.5));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
