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
import { FILL_SEEDS } from "./SmokingFillShared";
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
/** Round 5: shortened and thickened — 0.16 of the loop drew an eel. */
const BODY_SPAN = 0.13;

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
    emissiveIntensity: 0.32,
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
    // Widened in round 6: at 5.4 m the kiln itself occluded half of
    // every patrol from the pose's distance.
    const r = 7.0 + 1.2 * Math.sin(theta * 2 + phase);
    const x = kilnSpot.x + Math.cos(theta) * r;
    const z = kilnSpot.z + Math.sin(theta) * r;
    const overShoulder = Math.max(0, Math.sin(theta - phase)) ** 3 * 3.2;
    out.set(x, kilnY + 1.3 + 0.5 * Math.sin(theta * 3 + phase * 0.7) + overShoulder, z);
    return out;
  };

  const geometry = buildKeeperBody();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xff8c3a,
    emissiveIntensity: 0.55,
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

  const pose = makeBodyPoser(geometry, pathAt, 1, LOOP_SECONDS, 2.1);

  pose(0);
  geometry.computeBoundingSphere();
  // The patrol never leaves the kiln's reach; one honest sphere, forever.
  geometry.boundingSphere!.center.set(kilnSpot.x, kilnY + 2, kilnSpot.z);
  geometry.boundingSphere!.radius = 9;

  // ─── The hatchlings (Phase 3 fill — the resident made a family) ──────────
  // Two half-scale keeper bodies on short seam-loops at the kiln's north
  // and east feet (fill plan §5): no discovery target, no codex — they are
  // satellites of the centrepiece, not a second find. Fresh substream,
  // appended after every pilot draw (the fence); their loops hug the
  // kiln's feet (d ≤ ~8), far inside the north floor quadrant's rest ring
  // (which starts at d 12).
  const hatchRandom = new Random(SEED ^ FILL_SEEDS.hatchlings);
  const hatchPosers: ((time: number) => void)[] = [];
  const hatchSpecs = [
    { du: 0.4, dv: 5.6, ring: 2.0, loop: 21, dir: 1 },
    { du: 5.8, dv: -0.6, ring: 2.3, loop: 26, dir: -1 },
  ] as const;
  for (const [h, spec] of hatchSpecs.entries()) {
    const foot = worldOf(KILN.u + spec.du, KILN.v + spec.dv);
    const footY = seabedHeight(foot.x, foot.z);
    const hatchPhase = hatchRandom.range(0, Math.PI * 2);
    const hatchPath = (t: number, out: Vector3): Vector3 => {
      const theta = spec.dir * t * Math.PI * 2 + hatchPhase;
      const r = spec.ring + 0.35 * Math.sin(theta * 2 + hatchPhase);
      out.set(
        foot.x + Math.cos(theta) * r,
        footY + 0.7 + 0.25 * Math.sin(theta * 3 + hatchPhase * 0.7),
        foot.z + Math.sin(theta) * r,
      );
      return out;
    };
    const hatchGeometry = buildKeeperBody();
    const hatchMesh = new Mesh(hatchGeometry, material);
    hatchMesh.name = `smoulder-keeper-hatchling-${h}`;
    hatchMesh.castShadow = false;
    hatchMesh.receiveShadow = false;
    hatchMesh.frustumCulled = false;
    meshes.push(hatchMesh);
    const hatchPose = makeBodyPoser(hatchGeometry, hatchPath, 0.5, spec.loop, 3.1);
    hatchPose(0);
    hatchGeometry.computeBoundingSphere();
    // The loop never leaves the foot's reach; one honest sphere, forever.
    hatchGeometry.boundingSphere!.center.set(foot.x, footY + 1, foot.z);
    hatchGeometry.boundingSphere!.radius = spec.ring + 2.5;
    hatchPosers.push(hatchPose);
  }

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
      for (const hatchPose of hatchPosers) {
        hatchPose(slowTime);
      }
    },
  };
}

/**
 * The fixed-topology poser, shared by the Keeper and its hatchlings: the
 * body's positions are rewritten each frame along a closed path. `scale`
 * multiplies every body measure (radius, crest, leg reach); at 1 the
 * arithmetic is byte-identical to the pilot's inline poser (multiplying a
 * float by 1 is exact), which is what keeps the Keeper's fence.
 */
function makeBodyPoser(
  geometry: BufferGeometry,
  pathAt: (t: number, out: Vector3) => Vector3,
  scale: number,
  loopSeconds: number,
  wagRate: number,
): (time: number) => void {
  const position = geometry.attributes.position as BufferAttribute;
  const at = new Vector3();
  const ahead = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  const up = new Vector3(0, 1, 0);

  return (time: number): void => {
    const head = (time / loopSeconds) % 1;
    const wag = time * wagRate;
    for (let ring = 0; ring < RINGS; ring++) {
      const along = ring / (RINGS - 1);
      const s = (((head - along * BODY_SPAN) % 1) + 1) % 1;
      pathAt(s, at);
      pathAt((s + 0.008) % 1, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      lift.crossVectors(side, tangent).normalize();

      // The swim: a lateral wave that grows toward the tail.
      const sway = Math.sin(wag - along * 4.2) * (0.14 * scale) * along;
      at.addScaledVector(side, sway);

      const radius = bodyRadius(along) * scale;
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
      const crest = crestHeight(along) * scale;
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
      const radius = bodyRadius(along) * scale;
      for (const [k, dir] of [-1, 1].entries()) {
        const swing = Math.sin(wag * 0.9 + pair * Math.PI + k * Math.PI * 0.5) * (0.24 * scale);
        const base = legStart + (pair * 2 + k) * 2;
        const bx = at.x + side.x * dir * radius;
        const by = at.y + side.y * dir * radius - radius * 0.4;
        const bz = at.z + side.z * dir * radius;
        position.setXYZ(base, bx, by, bz);
        position.setXYZ(
          base + 1,
          bx + side.x * dir * (0.5 * scale) + tangent.x * swing - lift.x * (0.3 * scale),
          by + side.y * dir * (0.5 * scale) + tangent.y * swing - lift.y * (0.3 * scale),
          bz + side.z * dir * (0.5 * scale) + tangent.z * swing - lift.z * (0.3 * scale),
        );
      }
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };
}

// ─── The Keeper's body ───────────────────────────────────────────────────────

/** Blunt newt head, shoulder swell, waist, long flattened tail. */
function bodyRadius(along: number): number {
  const head = smoothstep01(along / 0.05) * (1 - smoothstep01((along - 0.06) / 0.1) * 0.18);
  const shoulder = 1 + 0.28 * Math.exp(-(((along - 0.24) / 0.14) ** 2));
  const taper = 1 - smoothstep01((along - 0.4) / 0.6) * 0.9;
  return 0.28 * head * shoulder * taper + 0.015;
}

function crestHeight(along: number): number {
  return 0.15 * Math.sin(Math.PI * Math.min(1, along * 1.1)) ** 0.8 * (1 - along * 0.25);
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
    // The seams: meridian cracks, widening toward the crown. Threshold
    // raised in round 6 — at 0.6 the whole dome read as a red balloon.
    const seam = smoothstep01(
      (fbm(theta * 1.6, y * 0.5, { seed: SEED ^ 0x5ea3, period: 4, octaves: 2 }) - (0.68 - t * 0.09)) /
        0.08,
    );
    shade.multiplyScalar(1 - seam * 0.5);
    shade.r += seam * EMBER.r * (0.5 + t * 0.5);
    shade.g += seam * EMBER.g * (0.4 + t * 0.4);
    shade.b += seam * EMBER.b * 0.3;
    // The crown vent: the throat glows.
    const crown = smoothstep01((t - 0.9) / 0.1) * (1 - smoothstep01((Math.hypot(x, z) - 0.5) / 0.5));
    shade.lerp(EMBER, crown * 0.7);
    // Sinter dust on the weather side.
    const dust =
      smoothstep01((fbm(theta * 3, y * 1.2, { seed: SEED ^ 0xd057, period: 3, octaves: 2 }) - 0.6) / 0.18) *
      0.18;
    shade.lerp(SINTER_PALE, dust);
    colors[i * 3] = Math.min(1, shade.r);
    colors[i * 3 + 1] = Math.min(1, shade.g);
    colors[i * 3 + 2] = Math.min(1, shade.b);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
