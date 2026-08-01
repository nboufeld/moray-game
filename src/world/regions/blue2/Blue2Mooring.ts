import {
  BufferAttribute,
  Color,
  LatheGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { createRockMaterial } from "../../RockMaterial";
import { archGeometry } from "../../RockShapes";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  B2_SEEDS,
  ROUND_VIOLET,
  SILT_BRIGHT,
  STONE_DUSK,
  applyVeinGlow,
  mergedMesh,
  palenStone,
  smoothstep01,
} from "./Blue2Shared";
import { FORD, MOORING_POSTS, WEIR, worldOf } from "./Blue2Terrain";

/**
 * THE MOORING — the region's skyline and its first exclusive: three
 * colossal pale posts rising thirty-odd metres off the Current's Step,
 * their crowns breaking the saddle's light far above the violet. The
 * myth is the Ferryman's: where its ancestors moored the world. Seen
 * from the Brink they are the amphitheatre's masts; seen from their
 * own feet they are the vertigo, inverted.
 *
 * THE WEIR — the great arch astride the Old Current at the Ford: the
 * road threads it as the river runs through it, one doorway shared by
 * two travellers.
 *
 * All three posts merge into ONE lit draw wearing drawn paint (the
 * Carillon's whole tower discipline inherited: profiles RESAMPLED to
 * 0.8 m rows so the strata have rows to live on; vein-glow so the
 * dusk-lift rides the paint; grooves violet, crowns pale).
 */

const SEED = SEEDS.regionBlue2;

export interface MooringBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

/** Resamples a profile polyline to ~`step`-metre rows before lathing. */
function resampleProfile(points: Vector2[], step: number): Vector2[] {
  const out: Vector2[] = [points[0]!.clone()];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const rows = Math.max(1, Math.round(a.distanceTo(b) / step));
    for (let r = 1; r <= rows; r++) {
      out.push(a.clone().lerp(b, r / rows));
    }
  }
  return out;
}

/** A post's drawn outline: root flare, entasis shaft, swollen cap head. */
function postProfile(height: number, radius: number, random: Random): Vector2[] {
  const r = radius;
  const h = height;
  return [
    new Vector2(r * 1.5, -0.9),
    new Vector2(r * 1.3, h * 0.05),
    new Vector2(r * 1.02, h * 0.16),
    new Vector2(r * random.range(0.8, 0.86), h * random.range(0.5, 0.58)),
    new Vector2(r * 0.92, h * 0.82),
    new Vector2(r * 0.86, h * 0.88),
    // The cap head: the pale crown the light finds first.
    new Vector2(r * 1.18, h * 0.92),
    new Vector2(r * 1.12, h * 0.97),
    new Vector2(r * 0.6, h * 0.995),
    new Vector2(0.01, h),
  ];
}

/** Groove ribs + drawn paint, applied to a lathed post in place. */
function ribAndPaint(geometry: BufferGeometry, height: number, ribs: number, seed: number): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  const pale = new Color(0xc4bac8);
  const bright = new Color().copy(SILT_BRIGHT);
  const violet = new Color().copy(ROUND_VIOLET);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const theta = Math.atan2(z, x);
    const t = Math.min(1, Math.max(0, y / height));
    // The ribs: shallow vertical grooves, fading at foot and cap.
    const groove = Math.sin(theta * ribs + t * 1.1);
    const band = smoothstep01((t - 0.08) / 0.12) * (1 - smoothstep01((t - 0.8) / 0.1));
    const rib = 1 + groove * 0.1 * band;
    if (radius > 0.02) {
      position.setX(i, x * rib);
      position.setZ(i, z * rib);
    }
    // Paint: the shaft climbs from a violet-drowned foot to a pale lit
    // crown — depth itself is the dimmer, written up the stone — with
    // strata bands, grain jitter and violet pooled in every groove.
    const strata = fbm(t * 7.2, theta * 0.7, { seed: seed ^ 0x17, period: 5, octaves: 2 }) - 0.5;
    const grain = fbm(theta * 2.4, y * 0.45, { seed: seed ^ 0x2b, period: 7, octaves: 2 }) - 0.5;
    // Rounds 2–3: fine grain amplitude up twice — at a close lens one
    // ~5 m strata band fills the whole frame and the shaft read flat;
    // the r3 pass also widens the value swing so the shade side keeps
    // its drawing instead of crushing to one violet.
    const fine = fbm(theta * 6.1, y * 2.1, { seed: seed ^ 0x3d, period: 9, octaves: 2 }) - 0.5;
    shade
      .copy(pale)
      .lerp(bright, 0.18 + smoothstep01((t - 0.3) / 0.6) * 0.62)
      .lerp(violet, Math.max(0, -groove) * 0.34 * band + Math.max(0, -strata) * 0.28)
      .multiplyScalar(1.04 + strata * 0.34 + grain * 0.34 + fine * 0.38);
    // The drowned foot: the deep's own violet, never black.
    shade.lerp(violet, (1 - smoothstep01((t - 0.04) / 0.16)) * 0.42);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

export function buildMooring(): MooringBuild {
  const random = new Random(SEED ^ B2_SEEDS.mooring);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const parts: BufferGeometry[] = [];
  const meshes: Mesh[] = [];

  for (const [i, post] of MOORING_POSTS.entries()) {
    const geometry = new LatheGeometry(
      resampleProfile(postProfile(post.height, post.radius, random), 0.8),
      24,
    );
    ribAndPaint(geometry, post.height, 5 + i, SEED ^ (B2_SEEDS.mooringPaint + i));
    const { x, z } = worldOf(post.u, post.v);
    const y = seabedHeight(x, z);
    geometry.rotateY(random.range(0, Math.PI * 2));
    geometry.translate(x, y, z);
    parts.push(geometry);

    contacts.push({ x, z, radius: post.radius * 1.8, strength: 0.45 });
    const steps = Math.ceil(post.height / 3.4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      colliders.push({
        center: new Vector3(x, y + 0.6 + post.height * t, z),
        radius: Math.max(1.1, post.radius * (1.3 - 0.45 * t)),
      });
    }
  }

  const material = createToonMaterial({
    color: 0xc9c0cf,
    vertexColors: true,
    emissive: STONE_DUSK,
    emissiveIntensity: 0.5,
  });
  applyVeinGlow(material, "blue2-mooring-dusk");
  meshes.push(mergedMesh(parts, material, "deepsteps-mooring"));

  // ─── THE WEIR ────────────────────────────────────────────────────────────
  // The arch's leg line runs PERPENDICULAR to the Current at the Ford,
  // so the river passes under the beam as the road passes through it.
  const arch = archGeometry({
    seed: SEED ^ B2_SEEDS.weir,
    span: WEIR.span,
    legHeight: 7.6,
    legRadius: 1.6,
    beamRadius: 1.4,
    rise: 2.4,
  });
  const flowU = 16;
  const flowV = -88;
  // Perpendicular to the flow, in spoke space, mapped to a world yaw.
  const a = worldOf(FORD.u, FORD.v);
  const b = worldOf(FORD.u + -flowV * 0.01, FORD.v + flowU * 0.01);
  const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
  arch.rotateY(yaw);
  const fordY = seabedHeight(a.x, a.z);
  arch.translate(a.x, fordY, a.z);
  // Round 2: the Weir joins the pale family outright — the r1 arch
  // wore the rock wash's rust and read as a different country's stone.
  palenStone(arch, 0.45);
  const weirMaterial = createRockMaterial(0xd2d8de);
  weirMaterial.emissive.setHex(STONE_DUSK);
  weirMaterial.emissiveIntensity = 0.38;
  meshes.push(mergedMesh([arch], weirMaterial, "deepsteps-weir"));
  contacts.push({ x: a.x, z: a.z, radius: WEIR.span * 0.7, strength: 0.35 });
  // Colliders on the two legs and the beam's crown (the opening stays
  // open — the road swims through).
  for (const side of [-1, 1]) {
    const legU = FORD.u + (-flowV / 89.4) * (WEIR.span / 2) * side;
    const legV = FORD.v + (flowU / 89.4) * (WEIR.span / 2) * side;
    const leg = worldOf(legU, legV);
    const legY = seabedHeight(leg.x, leg.z);
    colliders.push({ center: new Vector3(leg.x, legY + 2.2, leg.z), radius: 1.9 });
    colliders.push({ center: new Vector3(leg.x, legY + 5.6, leg.z), radius: 1.6 });
  }
  colliders.push({ center: new Vector3(a.x, fordY + 9.6, a.z), radius: 2.2 });

  return { meshes, colliders, contacts };
}
