import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LatheGeometry,
  Mesh,
  Vector2,
  Vector3,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { EMBER, SINTER_PALE, applyVeinGlow, smoothstep01 } from "./SmokingShared";
import { KILN, worldOf } from "./SmokingTerrain";

/**
 * The Old Kiln, and the Kiln Keeper who tends it.
 *
 * The kiln is the calm old thing at the caldera's centre: a great domed
 * mound like a potter's kiln sunk to its shoulders in the ash, charcoal-
 * violet, split by ember seams that glow from inside — the source the
 * jelly procession rises from.
 *
 * The Keeper is the region's findable resident: a salamander-newt spirit
 * that circles the kiln in one slow patrol, nose down, tending the vents.
 * The body is the pilot weaver's fixed-topology trick — a tube whose
 * *positions* are rewritten each frame along a closed path — with this
 * animal's own anatomy: a blunt newt head, a crested back ridge, four
 * stubby leg-fins that trail as it swims, and a long flattened tail.
 *
 * ## The paint
 *
 * Charcoal-violet back (the caldera's own dark, red above green), an
 * ember belly and throat that the vein-glow material reads as light —
 * in the haze the Keeper is a slow lantern, which is what makes it
 * findable — and a gold eye-stripe.
 */

const SEED = SEEDS.regionSmoking1;

export const KEEPER_SPECIES_ID = "kiln-keeper";

const RINGS = 40;
const SIDES = 6;
/** Two verts per ring for the back crest, four leg-fins of two verts each. */
const CREST_VERTS = RINGS * 2;
const LEG_RINGS = [12, 25] as const;
const LEG_VERTS = LEG_RINGS.length * 2 * 2;

/** One patrol of the kiln, in seconds — a calm animal. */
const LOOP_SECONDS = 34;
const BODY_SPAN = 0.16;

export interface KeeperBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildKeeper(): KeeperBuild {
  const random = new Random(SEED ^ 0x0ee7);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // ─── The Old Kiln ────────────────────────────────────────────────────────
  const kilnSpot = worldOf(KILN.u, KILN.v);
  const kilnY = seabedHeight(kilnSpot.x, kilnSpot.z);
  const kiln = kilnGeometry();
  kiln.translate(kilnSpot.x, kilnY, kilnSpot.z);
  kiln.computeBoundingSphere();
  const kilnMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xff7a38,
    emissiveIntensity: 0.5,
  });
  applyVeinGlow(kilnMaterial, "smoulder-kiln");
  const kilnMesh = new Mesh(kiln, kilnMaterial);
  kilnMesh.name = "smoulder-old-kiln";
  kilnMesh.castShadow = false;
  kilnMesh.receiveShadow = true;
  meshes.push(kilnMesh);
  colliders.push(
    { center: new Vector3(kilnSpot.x, kilnY + 1.6, kilnSpot.z), radius: 3.4 },
    { center: new Vector3(kilnSpot.x, kilnY + 3.8, kilnSpot.z), radius: 2.2 },
  );
  contacts.push({ x: kilnSpot.x, z: kilnSpot.z, radius: 5.4, strength: 0.45 });

  // ─── The Keeper ──────────────────────────────────────────────────────────
  const phase = random.range(0, Math.PI * 2);

  // The patrol: a wobbled ring around the kiln, hugging the floor, with a
  // slow climb over the kiln's shoulder once a lap — tending the seams.
  const pathAt = (t: number, out: Vector3): Vector3 => {
    const theta = t * Math.PI * 2;
    const r = 5.4 + 1.1 * Math.sin(theta * 2 + phase);
    const x = kilnSpot.x + Math.cos(theta) * r;
    const z = kilnSpot.z + Math.sin(theta) * r;
    const overShoulder = Math.max(0, Math.sin(theta - phase)) ** 3 * 2.6;
    out.set(x, kilnY + 1.0 + 0.5 * Math.sin(theta * 3 + phase * 0.7) + overShoulder, z);
    return out;
  };

  const geometry = buildKeeperBody();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xff8c3a,
    emissiveIntensity: 0.4,
  });
  applyVeinGlow(material, "smoulder-keeper");
  const mesh = new Mesh(geometry, material);
  mesh.name = "smoulder-kiln-keeper";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  meshes.push(mesh);

  const target: DiscoveryTarget = {
    speciesId: KEEPER_SPECIES_ID,
    position: new Vector3(kilnSpot.x, kilnY + 1.4, kilnSpot.z),
  };

  const position = geometry.attributes.position as BufferAttribute;
  const at = new Vector3();
  const ahead = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  const up = new Vector3(0, 1, 0);

  const pose = (time: number): void => {
    const head = (time / LOOP_SECONDS) % 1;
    const wag = time * 2.1;
    for (let ring = 0; ring < RINGS; ring++) {
      const along = ring / (RINGS - 1);
      const s = (((head - along * BODY_SPAN) % 1) + 1) % 1;
      pathAt(s, at);
      pathAt((s + 0.008) % 1, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      lift.crossVectors(side, tangent).normalize();

      // The swim: a lateral wave that grows toward the tail.
      const sway = Math.sin(wag - along * 4.2) * 0.14 * along;
      at.addScaledVector(side, sway);

      const radius = bodyRadius(along);
      const flat = 1 - smoothstep01((along - 0.55) / 0.45) * 0.55;
      for (let i = 0; i < SIDES; i++) {
        const a = (i / SIDES) * Math.PI * 2;
        const idx = ring * SIDES + i;
        position.setXYZ(
          idx,
          at.x + (side.x * Math.cos(a) * flat + lift.x * Math.sin(a)) * radius,
          at.y + (side.y * Math.cos(a) * flat + lift.y * Math.sin(a)) * radius * 1.15,
          at.z + (side.z * Math.cos(a) * flat + lift.z * Math.sin(a)) * radius,
        );
      }

      // The crest: a back ridge riding the spine, tallest at the shoulders.
      const crestBase = RINGS * SIDES + ring * 2;
      const crest = crestHeight(along);
      position.setXYZ(
        crestBase,
        at.x + lift.x * radius * 1.05,
        at.y + lift.y * radius * 1.05,
        at.z + lift.z * radius * 1.05,
      );
      position.setXYZ(
        crestBase + 1,
        at.x + lift.x * (radius * 1.05 + crest),
        at.y + lift.y * (radius * 1.05 + crest),
        at.z + lift.z * (radius * 1.05 + crest),
      );
    }

    // The leg-fins: four stubby paddles trailing off the shoulder and hip
    // rings, swinging opposite pairs as it swims.
    const legStart = RINGS * SIDES + CREST_VERTS;
    for (const [pair, ring] of LEG_RINGS.entries()) {
      const along = ring / (RINGS - 1);
      const s = (((head - along * BODY_SPAN) % 1) + 1) % 1;
      pathAt(s, at);
      pathAt((s + 0.008) % 1, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      lift.crossVectors(side, tangent).normalize();
      const radius = bodyRadius(along);
      for (const [k, dir] of [-1, 1].entries()) {
        const swing = Math.sin(wag * 0.9 + pair * Math.PI + k * Math.PI * 0.5) * 0.24;
        const base = legStart + (pair * 2 + k) * 2;
        const bx = at.x + side.x * dir * radius;
        const by = at.y + side.y * dir * radius - radius * 0.4;
        const bz = at.z + side.z * dir * radius;
        position.setXYZ(base, bx, by, bz);
        position.setXYZ(
          base + 1,
          bx + side.x * dir * 0.3 + tangent.x * swing - lift.x * 0.2,
          by + side.y * dir * 0.3 + tangent.y * swing - lift.y * 0.2,
          bz + side.z * dir * 0.3 + tangent.z * swing - lift.z * 0.2,
        );
      }
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  pose(0);
  geometry.computeBoundingSphere();
  // The patrol never leaves the kiln's reach; one honest sphere, forever.
  geometry.boundingSphere!.center.set(kilnSpot.x, kilnY + 2, kilnSpot.z);
  geometry.boundingSphere!.radius = 9;

  let slowTime = 0;
  let last = 0;
  return {
    meshes,
    colliders,
    contacts,
    target,
    update(time: number, reducedMotion: boolean): void {
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

// ─── The Keeper's body ───────────────────────────────────────────────────────

/** Blunt newt head, shoulder swell, waist, long flattened tail. */
function bodyRadius(along: number): number {
  const head = smoothstep01(along / 0.05) * (1 - smoothstep01((along - 0.06) / 0.1) * 0.18);
  const shoulder = 1 + 0.28 * Math.exp(-(((along - 0.24) / 0.14) ** 2));
  const taper = 1 - smoothstep01((along - 0.4) / 0.6) * 0.9;
  return 0.17 * head * shoulder * taper + 0.012;
}

function crestHeight(along: number): number {
  return 0.09 * Math.sin(Math.PI * Math.min(1, along * 1.1)) ** 0.8 * (1 - along * 0.25);
}

function buildKeeperBody(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertexCount = RINGS * SIDES + CREST_VERTS + LEG_VERTS;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const back = new Color(0x4c3f56);
  const flank = new Color(0x6b5560);
  const belly = new Color(0xff9448);
  const stripe = new Color(0xe8c060);
  const shade = new Color();

  for (let ring = 0; ring < RINGS; ring++) {
    const along = ring / (RINGS - 1);
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      // sin(a) is +1 at the crest, −1 at the belly line.
      const bellyMix = smoothstep01((-Math.sin(a) + 0.35) / 1.1);
      shade.copy(back).lerp(flank, smoothstep01((-Math.sin(a) + 1) / 1.4));
      shade.lerp(belly, bellyMix * (1 - smoothstep01((along - 0.7) / 0.3) * 0.5));
      // The eye-stripe: a gold band down each side of the head.
      if (along < 0.14 && Math.abs(Math.cos(a)) > 0.72) {
        shade.lerp(stripe, 0.7 * (1 - along / 0.14));
      }
      // Ember freckles down the back — the vents' own sparks.
      const freckle = smoothstep01(
        (fbm(along * 9, a * 0.9, { seed: SEED ^ 0xf2ec, period: 5, octaves: 2 }) - 0.62) / 0.1,
      );
      shade.lerp(EMBER, freckle * 0.55 * (1 - bellyMix));
      const idx = ring * SIDES + i;
      colors[idx * 3] = shade.r;
      colors[idx * 3 + 1] = shade.g;
      colors[idx * 3 + 2] = shade.b;
    }
    // The crest wears the stripe's gold, dimmed toward the tail.
    const crestBase = RINGS * SIDES + ring * 2;
    for (const [k, mix] of [0.35, 0.85].entries()) {
      shade.copy(back).lerp(stripe, mix * (1 - along * 0.4));
      colors[(crestBase + k) * 3] = shade.r;
      colors[(crestBase + k) * 3 + 1] = shade.g;
      colors[(crestBase + k) * 3 + 2] = shade.b;
    }
  }
  // The leg-fins wear the belly's ember.
  const legStart = RINGS * SIDES + CREST_VERTS;
  for (let i = 0; i < LEG_VERTS; i++) {
    shade.copy(belly).multiplyScalar(i % 2 === 0 ? 0.8 : 1);
    colors[(legStart + i) * 3] = shade.r;
    colors[(legStart + i) * 3 + 1] = shade.g;
    colors[(legStart + i) * 3 + 2] = shade.b;
  }

  // Tube strips.
  for (let ring = 0; ring < RINGS - 1; ring++) {
    const a = ring * SIDES;
    const b = a + SIDES;
    for (let i = 0; i < SIDES; i++) {
      const next = (i + 1) % SIDES;
      indices.push(a + i, a + next, b + i);
      indices.push(a + next, b + next, b + i);
    }
  }
  // The crest: a two-sided strip.
  for (let ring = 0; ring < RINGS - 1; ring++) {
    const a = RINGS * SIDES + ring * 2;
    const b = a + 2;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    indices.push(b, a + 1, a, b, b + 1, a + 1);
  }
  // The leg-fins: doubled-winding pairs off their base ring vertices.
  for (const [pair, ring] of LEG_RINGS.entries()) {
    for (const [k] of [-1, 1].entries()) {
      const base = legStart + (pair * 2 + k) * 2;
      // Anchor each fin to the tube ring's nearest side vertex.
      const anchor = ring * SIDES + (k === 0 ? 4 : 2);
      indices.push(anchor, base, base + 1, base + 1, base, anchor);
    }
  }

  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

// ─── The kiln's geometry ─────────────────────────────────────────────────────

/**
 * The Old Kiln: a potter's dome sunk to its shoulders, charcoal-violet
 * with ember seams. The seams brighten toward the crown vent — the same
 * value logic as the smokers, at architectural scale.
 */
function kilnGeometry(): BufferGeometry {
  const points: Vector2[] = [
    new Vector2(0, 4.9),
    new Vector2(0.6, 4.95),
    new Vector2(1.4, 4.6),
    new Vector2(2.4, 3.9),
    new Vector2(3.2, 2.9),
    new Vector2(3.8, 1.7),
    new Vector2(4.1, 0.5),
    new Vector2(4.2, -0.4),
    new Vector2(0, -0.4),
  ];
  const geometry = new LatheGeometry(points, 16);
  smoothNormals(geometry);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const bodyLow = new Color(0x51445c);
  const bodyHigh = new Color(0x6e5c62);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = Math.min(1, Math.max(0, y / 4.95));
    const theta = Math.atan2(z, x);
    shade.copy(bodyLow).lerp(bodyHigh, t);
    // The seams: meridian cracks, widening toward the crown.
    const seam = smoothstep01(
      (fbm(theta * 1.6, y * 0.5, { seed: SEED ^ 0x5ea3, period: 4, octaves: 2 }) - (0.6 - t * 0.08)) /
        0.1,
    );
    shade.multiplyScalar(1 - seam * 0.5);
    shade.r += seam * EMBER.r * (0.5 + t * 0.5);
    shade.g += seam * EMBER.g * (0.4 + t * 0.4);
    shade.b += seam * EMBER.b * 0.3;
    // The crown vent: the throat glows.
    const crown = smoothstep01((t - 0.9) / 0.1) * (1 - smoothstep01((Math.hypot(x, z) - 0.5) / 0.5));
    shade.lerp(EMBER, crown * 0.9);
    // Sinter dust on the weather side.
    const dust =
      smoothstep01((fbm(theta * 3, y * 1.2, { seed: SEED ^ 0xd057, period: 3, octaves: 2 }) - 0.6) / 0.18) *
      0.3;
    shade.lerp(SINTER_PALE, dust);
    colors[i * 3] = Math.min(1, shade.r);
    colors[i * 3 + 1] = Math.min(1, shade.g);
    colors[i * 3 + 2] = Math.min(1, shade.b);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
