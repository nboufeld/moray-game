import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  Vector2,
  Vector3,
  type DataTexture,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { GLASS_PALE, applyVeinGlow, smoothstep01 } from "./GoldenShared";
import { GLASS, worldOf } from "./GoldenTerrain";

/**
 * The Glass Reach: where old heat fused the sand. Standing glass fins in
 * loose rows along the trench grooves, one great fused arch to swim
 * through, and a field of static glints where the surfaces catch light.
 *
 * ## Reading as glass in toon values
 *
 * A toon material cannot refract, so "glass" is a painted argument: a
 * deep sea-green core rising to a near-white crest (the value range of
 * light through thick glass), crest paint the vein-glow material reads
 * as a faint light of its own, and the glint sparks over the field. The
 * silhouette does the rest — smooth, blade-thin, nothing hand-hewn.
 */

const SEED = SEEDS.regionGolden1;

const GLASS_DEEP = new Color(0x4e8a72);
const GLASS_CREST = new Color(0xeefcf0);

export interface GoldenGlassBuild {
  readonly meshes: (Mesh | InstancedMesh | Points)[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

/** One smooth fused blade: a tall narrow lathe flattened into a fin. */
function finGeometry(): BufferGeometry {
  const profile: readonly (readonly [number, number])[] = [
    [0, -0.4],
    [0.5, -0.36],
    [0.62, -0.1],
    [0.58, 0.6],
    [0.44, 1.6],
    [0.3, 2.6],
    [0.16, 3.4],
    [0, 3.8],
  ];
  const geometry = new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    10,
  );
  geometry.scale(1, 1, 0.32);
  smoothNormals(geometry);

  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01((position.getY(i) + 0.4) / 4.2);
    shade.copy(GLASS_DEEP).lerp(GLASS_CREST, t * t);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

export function buildGoldenGlass(): GoldenGlassBuild {
  const random = new Random(SEED ^ 0x61a5);
  const meshes: (Mesh | InstancedMesh | Points)[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // ─── The fins ────────────────────────────────────────────────────────────
  const finMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xbfe8d0,
    emissiveIntensity: 0.16,
  });
  applyVeinGlow(finMaterial, "hourglass-glass-fin");

  const count = 26;
  const fins = new InstancedMesh(finGeometry(), finMaterial, count);
  fins.name = "hourglass-glass-fins";
  fins.castShadow = false;
  fins.receiveShadow = false;

  const dummy = new Object3D();
  const tint = new Color();
  const finSpots: { u: number; v: number; s: number }[] = [];
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 300) {
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * (GLASS.radius * 0.82);
    const u = GLASS.u + Math.cos(angle) * spread;
    const v = GLASS.v + Math.sin(angle) * spread;
    // The fins stand on the groove crests, in loose rows: reject the
    // trench floors so the rows follow the fused ridges.
    if (Math.sin((u * 0.42 + v * 0.91) * 0.34 + 1.1) < -0.1) {
      continue;
    }
    const s = random.range(0.6, 1.7);
    finSpots.push({ u, v, s });
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    dummy.position.set(x, y - 0.2, z);
    dummy.rotation.set(random.signed(0.14), random.range(0, Math.PI * 2), random.signed(0.14));
    dummy.scale.set(s * random.range(0.8, 1.2), s, s * random.range(0.8, 1.25));
    dummy.updateMatrix();
    fins.setMatrixAt(placed, dummy.matrix);
    tint.setScalar(random.range(0.85, 1.1));
    fins.setColorAt(placed, tint);
    contacts.push({ x, z, radius: 0.9 * s, strength: 0.35 });
    if (s > 0.9) {
      colliders.push({ center: new Vector3(x, y + 1.4 * s, z), radius: 0.65 * s });
    }
    placed++;
  }
  fins.count = placed;
  fins.instanceMatrix.needsUpdate = true;
  if (fins.instanceColor) {
    fins.instanceColor.needsUpdate = true;
  }
  fins.computeBoundingSphere();
  meshes.push(fins);

  // ─── The Fused Arch ──────────────────────────────────────────────────────
  // A swim-through of glass over the widest trench: two lathes leaning
  // toward each other would seam, so it is one bent tube authored as a
  // ring of stations — smooth, thick at the feet, thin at the crown.
  const archAt = worldOf(GLASS.u + 4, GLASS.v - 2);
  const archYaw = random.range(0, Math.PI);
  const arch = archGeometry(archAt.x, archAt.z, archYaw);
  const archMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xbfe8d0,
    emissiveIntensity: 0.14,
  });
  applyVeinGlow(archMaterial, "hourglass-glass-arch");
  const archMesh = new Mesh(arch.geometry, archMaterial);
  archMesh.name = "hourglass-glass-arch";
  archMesh.castShadow = false;
  archMesh.receiveShadow = false;
  meshes.push(archMesh);
  colliders.push(...arch.colliders);
  contacts.push(
    { x: arch.footA.x, z: arch.footA.z, radius: 2.4, strength: 0.4 },
    { x: arch.footB.x, z: arch.footB.z, radius: 2.4, strength: 0.4 },
  );

  // ─── The glints ──────────────────────────────────────────────────────────
  // Static sparks where the fused field catches the light: one additive
  // Points draw seeded onto fin crests and groove edges.
  const glintCount = 120;
  const glints = new Float32Array(glintCount * 3);
  for (let i = 0; i < glintCount; i++) {
    if (i < finSpots.length * 2) {
      const spot = finSpots[i % finSpots.length]!;
      const { x, z } = worldOf(spot.u + random.signed(0.5), spot.v + random.signed(0.5));
      glints[i * 3] = x;
      glints[i * 3 + 1] = seabedHeight(x, z) + spot.s * random.range(1.6, 3.4);
      glints[i * 3 + 2] = z;
    } else {
      const angle = random.range(0, Math.PI * 2);
      const spread = Math.sqrt(random.next()) * (GLASS.radius * 0.85);
      const { x, z } = worldOf(GLASS.u + Math.cos(angle) * spread, GLASS.v + Math.sin(angle) * spread);
      glints[i * 3] = x;
      glints[i * 3 + 1] = seabedHeight(x, z) + random.range(0.1, 0.5);
      glints[i * 3 + 2] = z;
    }
  }
  const glintGeometry = new BufferGeometry();
  glintGeometry.setAttribute("position", new BufferAttribute(glints, 3));
  glintGeometry.computeBoundingSphere();
  const glintPoints = new Points(
    glintGeometry,
    new PointsMaterial({
      size: 0.16,
      map: glintSprite(),
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  glintPoints.name = "hourglass-glass-glints";
  meshes.push(glintPoints);

  return { meshes, colliders, contacts };
}

/** The arch: a bent tube of glass, stations swept over a half-ellipse. */
function archGeometry(
  cx: number,
  cz: number,
  yaw: number,
): {
  geometry: BufferGeometry;
  colliders: SphereCollider[];
  footA: Vector3;
  footB: Vector3;
} {
  const span = 11;
  const rise = 6.5;
  const stations = 16;
  const sides = 8;

  const dirX = Math.cos(yaw);
  const dirZ = Math.sin(yaw);
  const yA = seabedHeight(cx - dirX * (span / 2), cz - dirZ * (span / 2));
  const yB = seabedHeight(cx + dirX * (span / 2), cz + dirZ * (span / 2));

  const centres: Vector3[] = [];
  const radii: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const along = (t - 0.5) * span;
    const foot = yA + (yB - yA) * t;
    const y = foot - 0.6 + Math.sin(t * Math.PI) * (rise + 0.6);
    centres.push(new Vector3(cx + dirX * along, y, cz + dirZ * along));
    radii.push(1.5 - Math.sin(t * Math.PI) * 0.75);
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const shade = new Color();
  const tangent = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const worldUp = new Vector3(0, 1, 0);
  for (let i = 0; i <= stations; i++) {
    const at = centres[i]!;
    const next = centres[Math.min(stations, i + 1)]!;
    const prev = centres[Math.max(0, i - 1)]!;
    tangent.subVectors(next, prev).normalize();
    side.crossVectors(tangent, worldUp).normalize();
    up.crossVectors(side, tangent).normalize();
    const t = i / stations;
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const radius = radii[i]!;
      positions.push(
        at.x + (side.x * Math.cos(a) + up.x * Math.sin(a)) * radius,
        at.y + (side.y * Math.cos(a) + up.y * Math.sin(a)) * radius,
        at.z + (side.z * Math.cos(a) + up.z * Math.sin(a)) * radius,
      );
      const crown = Math.sin(t * Math.PI);
      shade.copy(GLASS_DEEP).lerp(GLASS_CREST, 0.25 + crown * 0.65);
      shade.lerp(GLASS_PALE, 0.2);
      colors.push(shade.r, shade.g, shade.b);
    }
  }
  for (let i = 0; i < stations; i++) {
    const a = i * sides;
    const b = a + sides;
    for (let k = 0; k < sides; k++) {
      const nk = (k + 1) % sides;
      indices.push(a + k, a + nk, b + k, a + nk, b + nk, b + k);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  smoothNormals(geometry);
  geometry.computeBoundingSphere();

  // Colliders ride the tube, leaving the passage under the crown open.
  const colliders: SphereCollider[] = [];
  for (let i = 0; i <= stations; i += 2) {
    colliders.push({ center: centres[i]!.clone(), radius: radii[i]! + 0.25 });
  }

  return { geometry, colliders, footA: centres[0]!, footB: centres[stations]! };
}

let glintSpriteTexture: DataTexture | undefined;
function glintSprite(): DataTexture {
  glintSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const spark = Math.pow(Math.max(0, 1 - d), 3);
    const cross =
      Math.pow(Math.max(0, 1 - Math.abs(u - 0.5) * 6), 2) +
      Math.pow(Math.max(0, 1 - Math.abs(v - 0.5) * 6), 2);
    const halo = Math.min(1, spark + cross * Math.pow(Math.max(0, 1 - d), 1.5) * 0.6);
    const warm = fbm(u, v, { seed: 0x611f, period: 3, octaves: 1 }) * 0.1;
    return [halo, halo * (0.98 - warm), halo * 0.9];
  });
  return glintSpriteTexture;
}
