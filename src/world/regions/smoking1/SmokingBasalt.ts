import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Object3D,
  Vector3,
  type BufferGeometry,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { smoothstep01 } from "./SmokingShared";
import { BASALT, BASALT_STEP, basaltWeight, worldOf } from "./SmokingTerrain";

/**
 * The Basalt Steps: columnar-jointed country. The terrain's benches carry
 * the big form; this module stands the columns that say *why* the ground
 * is stepped — hexagonal jointing along every terrace riser, a broken
 * colonnade to swim through on the approach, and the Organ Steps at the
 * crown, a half-circle of tall pipes the whole sub-biome composes toward.
 *
 * Three faceted archetypes, instanced (the field reads as hundreds of
 * columns; the GPU sees three shapes). The break-tops are authored per
 * archetype — a hex column snaps along its joints, so the top is a tilted
 * plane, not a lathe crater. Paint is baked per vertex: violet-charcoal
 * foot, warm grey shaft, pale sinter-dusted break face (value first — the
 * break faces are the bright notes the terrace edges read by), and every
 * face flat-shaded, because columnar jointing IS its facets.
 */

const SEED = SEEDS.regionSmoking1;

export interface SmokingBasaltBuild {
  readonly meshes: InstancedMesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

/** The Broken Colonnade: the swim-through arcade on the meadow approach. */
export const COLONNADE = { u: 393, v: 52, heading: 0.72 } as const;
/** The Organ Steps: the crown's half-circle of pipes. */
export const ORGAN = { u: 424, v: 96 } as const;

// Lightened a step in round 2: the columns read as flat plum monoliths —
// the shaft is a warm grey the violet foot can be a shadow *under*.
const FOOT_TINT = new Color(0x554a5c);
const SHAFT_TINT = new Color(0x7e7370);
const BREAK_TINT = new Color(0xb4a698);

/** One faceted hex column, unit height, break-top tilted along a joint. */
function columnGeometry(variant: number): BufferGeometry {
  const random = new Random(SEED ^ (0xba17 + variant * 0x9e37));
  const geometry = new CylinderGeometry(0.5, 0.56, 1, 6, 3).toNonIndexed();
  geometry.translate(0, 0.5, 0);

  const tiltX = random.signed(0.16);
  const tiltZ = random.signed(0.16);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    // The break: the top cap and the shaft's top ring tilt on one plane.
    if (y > 0.95) {
      position.setY(i, y + tiltX * x + tiltZ * z);
    }
    // A light waist so the shaft is not a ruler.
    const waist = 1 - 0.05 * Math.sin(y * Math.PI);
    position.setX(i, x * waist);
    position.setZ(i, z * waist);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  // The paint: violet foot, warm shaft, pale break face — with a per-face
  // value drift read off the facet's own direction, so the six faces
  // carry six close values the way a painted prism would.
  const normal = geometry.attributes.normal!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, y));
    if (normal.getY(i) > 0.6) {
      shade.copy(BREAK_TINT);
    } else if (t < 0.35) {
      shade.copy(FOOT_TINT).lerp(SHAFT_TINT, smoothstep01(t / 0.35));
    } else {
      shade.copy(SHAFT_TINT).lerp(BREAK_TINT, smoothstep01((t - 0.35) / 0.85) * 0.4);
    }
    const face = Math.atan2(normal.getZ(i), normal.getX(i));
    const drift = 0.92 + 0.12 * Math.sin(face * 3 + variant);
    const grain =
      0.94 + fbm(position.getX(i) * 2 + variant, y * 3, { seed: SEED ^ 0xface, period: 4, octaves: 2 }) * 0.12;
    shade.multiplyScalar(drift * grain);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

interface ColumnSpot {
  readonly u: number;
  readonly v: number;
  readonly height: number;
  readonly radius: number;
  readonly yaw: number;
  /** Lying columns rotate onto their side. */
  readonly fallen?: boolean;
  readonly lean?: number;
  readonly collide?: boolean;
}

export function buildSmokingBasalt(): SmokingBasaltBuild {
  const random = new Random(SEED ^ 0xba5e);
  const spots: ColumnSpot[] = [];

  // ─── The riser columns ───────────────────────────────────────────────────
  // Columnar jointing along the terrace edges: candidates scattered over
  // the country, kept where the bench math says a riser is — so the
  // columns stand exactly on the steps the terrain drew.
  let attempts = 0;
  while (spots.length < 150 && attempts < 900) {
    attempts++;
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * (BASALT.radius * 0.94);
    const u = BASALT.u + Math.cos(angle) * spread;
    const v = BASALT.v + Math.sin(angle) * spread;
    const w = basaltWeight(u, v);
    if (w < 0.3) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    const rawRise =
      10.4 * w + (fbm(x * 0.016, z * 0.016, { seed: SEED ^ 0xba5a, period: 7, octaves: 2 }) - 0.5) * 3;
    const frac = rawRise / BASALT_STEP - Math.floor(rawRise / BASALT_STEP);
    if (frac < 0.55) {
      continue;
    }
    if (Math.hypot(u - COLONNADE.u, v - COLONNADE.v) < 16) {
      continue;
    }
    if (Math.hypot(u - ORGAN.u, v - ORGAN.v) < 14) {
      continue;
    }
    if (spots.some((s) => Math.hypot(s.u - u, s.v - v) < 1.5)) {
      continue;
    }
    const height = random.range(0.9, 2.6) + w * random.range(0, 1.4);
    spots.push({
      u,
      v,
      height,
      radius: random.range(0.42, 0.62),
      yaw: random.range(0, Math.PI / 3),
      lean: random.signed(0.05),
      collide: height > 2.2,
    });
  }

  // ─── The Broken Colonnade ────────────────────────────────────────────────
  // Two rows of tall columns leaning toward each other over a 4.5 m
  // aisle — the doorway into the country, swim-through by construction.
  const along = { u: Math.cos(COLONNADE.heading), v: Math.sin(COLONNADE.heading) };
  const across = { u: -along.v, v: along.u };
  for (let i = 0; i < 6; i++) {
    const s = (i - 2.5) * 4.6;
    for (const side of [-1, 1]) {
      const broken = (i === 2 && side === 1) || (i === 4 && side === -1);
      spots.push({
        u: COLONNADE.u + along.u * s + across.u * side * 4.5,
        v: COLONNADE.v + along.v * s + across.v * side * 4.5,
        height: broken ? random.range(2.2, 3) : random.range(5.2, 6.6),
        radius: random.range(0.55, 0.7),
        yaw: random.range(0, Math.PI / 3),
        lean: -side * random.range(0.1, 0.16),
        collide: true,
      });
    }
  }
  // Two fallen shafts across the aisle's shoulders, half-sunk.
  for (const [i, s] of [-7, 6].entries()) {
    spots.push({
      u: COLONNADE.u + along.u * s + across.u * (i === 0 ? 2 : -1.6),
      v: COLONNADE.v + along.v * s + across.v * (i === 0 ? 2 : -1.6),
      height: random.range(4.4, 5.4),
      radius: random.range(0.5, 0.62),
      yaw: COLONNADE.heading + (i === 0 ? 0.5 : -0.85),
      fallen: true,
      collide: true,
    });
  }

  // ─── The Organ Steps ─────────────────────────────────────────────────────
  // A half-circle of pipes at the crown, heights stepping like a rank of
  // organ pipes — the country's skyline, visible from the ash flats.
  const pipes = 13;
  for (let i = 0; i < pipes; i++) {
    const theta = -0.4 + (i / (pipes - 1)) * Math.PI * 1.15;
    const r = 10.5 + random.signed(0.8);
    const step = Math.abs(i - (pipes - 1) / 2);
    spots.push({
      u: ORGAN.u + Math.cos(theta) * r,
      v: ORGAN.v + Math.sin(theta) * r,
      height: 8.2 - step * 0.85 + random.signed(0.4),
      radius: random.range(0.62, 0.78),
      yaw: random.range(0, Math.PI / 3),
      lean: random.signed(0.03),
      collide: true,
    });
  }

  // ─── Fallen scatter ──────────────────────────────────────────────────────
  // Broken shafts lying on the treads, the country's own rubble.
  for (let i = 0; i < 14; i++) {
    const angle = random.range(0, Math.PI * 2);
    const spread = Math.sqrt(random.next()) * (BASALT.radius * 0.8);
    const u = BASALT.u + Math.cos(angle) * spread;
    const v = BASALT.v + Math.sin(angle) * spread;
    if (basaltWeight(u, v) < 0.35 || Math.hypot(u - COLONNADE.u, v - COLONNADE.v) < 14) {
      continue;
    }
    spots.push({
      u,
      v,
      height: random.range(1.8, 3.6),
      radius: random.range(0.4, 0.56),
      yaw: random.range(0, Math.PI * 2),
      fallen: true,
    });
  }

  // ─── Instancing ──────────────────────────────────────────────────────────
  const archetypes = [0, 1, 2].map((variant) => columnGeometry(variant));
  const material = createToonMaterial({ vertexColors: true });
  const perArchetype = Math.ceil(spots.length / archetypes.length) + 2;
  const meshes = archetypes.map((geometry) => {
    const mesh = new InstancedMesh(geometry, material, perArchetype);
    mesh.name = "smoulder-basalt-columns";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  });

  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const dummy = new Object3D();
  const tint = new Color();
  const counts = [0, 0, 0];
  const variantRandom = new Random(SEED ^ 0xba1f);

  for (const spot of spots) {
    const variant = Math.floor(variantRandom.next() * archetypes.length);
    const mesh = meshes[variant]!;
    const { x, z } = worldOf(spot.u, spot.v);
    const y = seabedHeight(x, z);

    if (spot.fallen) {
      dummy.position.set(x, y + spot.radius * 0.7, z);
      dummy.rotation.set(Math.PI / 2 - 0.06, spot.yaw, variantRandom.signed(0.2));
      // A lying column's "height" runs along the ground.
      dummy.scale.set(spot.radius * 2, spot.height, spot.radius * 2);
      dummy.updateMatrix();
      // Rotate about the foot: shift so the shaft lies from the seat.
      dummy.matrix.multiply(new Matrix4().makeTranslation(0, -0.06, 0));
    } else {
      dummy.position.set(x, y - 0.25, z);
      dummy.rotation.set(spot.lean ?? 0, spot.yaw, (spot.lean ?? 0) * 0.7);
      dummy.scale.set(spot.radius * 2, spot.height + 0.25, spot.radius * 2);
      dummy.updateMatrix();
    }
    mesh.setMatrixAt(counts[variant]!, dummy.matrix);
    tint.setScalar(1).multiplyScalar(variantRandom.range(0.86, 1.1));
    mesh.setColorAt(counts[variant]!, tint);
    counts[variant]!++;

    if (spot.collide) {
      if (spot.fallen) {
        colliders.push({ center: new Vector3(x, y + spot.radius, z), radius: spot.height * 0.42 });
      } else {
        colliders.push({
          center: new Vector3(x, y + spot.height * 0.4, z),
          radius: Math.max(0.9, spot.radius * 1.5),
        });
        if (spot.height > 4.5) {
          colliders.push({
            center: new Vector3(x, y + spot.height * 0.82, z),
            radius: Math.max(0.8, spot.radius * 1.3),
          });
        }
      }
      contacts.push({ x, z, radius: spot.radius * 3, strength: 0.4 });
    }
  }

  for (const [variant, mesh] of meshes.entries()) {
    mesh.count = counts[variant]!;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }

  return { meshes, colliders, contacts };
}
