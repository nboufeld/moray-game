import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import type { ContactPatch } from "../../Seabed";
import { chalkTexture, mergedMesh, smoothstep01 } from "./Pale2Shared";
import { LAMP, pale2TerrainTarget, worldOf } from "./Pale2Terrain";
import type { FanAnchor } from "./Pale2Combs";

/**
 * THE LAMP — the region's landmark and the province's named light
 * peak: a 25 m hollow chalk lantern-spire standing in its crater. An
 * onion-dome foot rises to a waist; nine curved ribs bow outward and
 * gather again at the crown finial, caging an open chamber; inside
 * hangs the LIGHT — a warm-glowing heart the whole province's paper is
 * held to. The rib gaps are wide enough to swim (the Lampwright's
 * patrol threads them), and the widest gap — the mouth — faces the
 * road, where the discovery target waits.
 *
 * Paint: chalk outside (strata banding, milky crown), candle-gold
 * pre-lit warmth on every inward face — the chamber reads lit even
 * where the emissive heart is occluded. The heart itself carries a
 * vertex-gradient emissive (apex-lit, the glow-colony discipline at
 * landmark scale) well under the bloom threshold.
 */

const SEED = SEEDS.regionPale2;

const RIBS = 9;
const RIB_SEGMENTS = 18;

export interface Pale2LampBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Fan seats on the outer rib faces. */
  readonly fanAnchors: readonly FanAnchor[];
  /** Interior floor anchors for the kit glow garden. */
  readonly glowAnchors: readonly (readonly [number, number, number])[];
  /** The mouth window's world position (the discovery target's seat). */
  readonly mouth: { x: number; y: number; z: number; facing: number };
  /** The heart's world position, for the light module's shaft. */
  readonly heart: { x: number; y: number; z: number };
}

/** The rib centre-line: waist radius → bulge → crown gather. */
function ribRadius(h: number): number {
  return 4.2 + 3.1 * Math.sin(Math.PI * Math.min(1, h * 1.04)) - 3.5 * smoothstep01((h - 0.9) / 0.1);
}

export function buildPale2Lamp(): Pale2LampBuild {
  const random = new Random(SEED ^ 0x0c01);
  const center = worldOf(LAMP.u, LAMP.v);
  const ground = pale2TerrainTarget(center.x, center.z);
  const top = ground + LAMP.height;

  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const fanAnchors: FanAnchor[] = [];
  const glowAnchors: (readonly [number, number, number])[] = [];
  const parts: BufferGeometry[] = [];

  // The mouth faces back down the road (toward −u, the way the diver
  // arrives): rib gap 0 is widened by leaning ribs 0 and 8 apart.
  const mouthTheta = Math.atan2(
    worldOf(LAMP.u - 10, LAMP.v).z - center.z,
    worldOf(LAMP.u - 10, LAMP.v).x - center.x,
  );

  // ── The foot: an onion dome rising to the waist ────────────────────
  {
    const SIDES = 22;
    const LEVELS = 7;
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let j = 0; j <= LEVELS; j++) {
      const h = j / LEVELS;
      const y = ground - 1.2 + (5.4 + 1.2) * h;
      // Onion profile: broad at the ground, tucking to the waist.
      const radius = 6.2 * (1 - h * 0.4) * (1 - 0.28 * smoothstep01((h - 0.55) / 0.45)) + 0.4;
      for (let s = 0; s <= SIDES; s++) {
        const a = (s / SIDES) * Math.PI * 2;
        const wobble = 1 + 0.05 * Math.sin(a * 5 + h * 4 + random.next() * 0.01);
        positions.push(
          center.x + Math.cos(a) * radius * wobble,
          y,
          center.z + Math.sin(a) * radius * wobble,
        );
        const band = 0.5 + 0.5 * Math.sin(h * 9);
        const root = 1 - smoothstep01((h - 0.03) / 0.3);
        colors.push(
          0.99 - root * 0.2 + (band - 0.5) * 0.05,
          0.98 - root * 0.26 + (band - 0.5) * 0.05,
          1.0 - root * 0.12 + (band - 0.5) * 0.03,
        );
        uvs.push((s / SIDES) * 6.5, h * 1.1);
      }
    }
    for (let j = 0; j < LEVELS; j++) {
      for (let s = 0; s < SIDES; s++) {
        const a = j * (SIDES + 1) + s;
        const b = a + SIDES + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(indices);
    parts.push(geometry);
  }

  // ── The ribs: nine bowed blades caging the chamber ─────────────────
  const waistY = ground + 5.4;
  const cageSpan = top - 1.6 - waistY;
  for (let ribIndex = 0; ribIndex < RIBS; ribIndex++) {
    let theta = mouthTheta + ((ribIndex + 0.5) / RIBS) * Math.PI * 2;
    // The mouth: the two ribs flanking gap 0 lean apart a half step.
    if (ribIndex === 0) {
      theta += 0.16;
    } else if (ribIndex === RIBS - 1) {
      theta -= 0.16;
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const width = 0.62;
    const depth = 0.5;
    for (let j = 0; j <= RIB_SEGMENTS; j++) {
      const h = j / RIB_SEGMENTS;
      const radius = ribRadius(h);
      const y = waistY + cageSpan * h;
      const swirl = theta + h * 0.35; // the cage twists gently as it rises
      const cx = center.x + Math.cos(swirl) * radius;
      const cz = center.z + Math.sin(swirl) * radius;
      const outX = Math.cos(swirl);
      const outZ = Math.sin(swirl);
      const tanX = -outZ;
      const tanZ = outX;
      // Four corners of the rib's rectangular cross-section.
      for (const [ox, oz] of [
        [outX * (depth / 2) + tanX * (width / 2), outZ * (depth / 2) + tanZ * (width / 2)],
        [outX * (depth / 2) - tanX * (width / 2), outZ * (depth / 2) - tanZ * (width / 2)],
        [-outX * (depth / 2) - tanX * (width / 2), -outZ * (depth / 2) - tanZ * (width / 2)],
        [-outX * (depth / 2) + tanX * (width / 2), -outZ * (depth / 2) + tanZ * (width / 2)],
      ] as const) {
        positions.push(cx + ox, y, cz + oz);
      }
      // Outer corners chalk; inner corners pre-lit candle gold —
      // round 3: the gold's green raised (the r2 chamber leant pink).
      const crest = smoothstep01((h - 0.75) / 0.22);
      for (const [corner, inner] of [false, false, true, true].entries()) {
        if (inner) {
          colors.push(1.05, 0.97, 0.72);
        } else {
          colors.push(0.98 + crest * 0.08, 0.97 + crest * 0.07, 1.0 + crest * 0.1);
        }
        uvs.push(corner * 0.09, h * (cageSpan / 6));
      }
    }
    for (let j = 0; j < RIB_SEGMENTS; j++) {
      const a = j * 4;
      const b = a + 4;
      for (let corner = 0; corner < 4; corner++) {
        const next = (corner + 1) % 4;
        indices.push(a + corner, b + corner, a + next, b + corner, b + next, a + next);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(indices);
    parts.push(geometry);

    // Rib colliders: three spheres along the bow.
    for (const h of [0.12, 0.45, 0.8]) {
      const radius = ribRadius(h);
      const swirl = theta + h * 0.35;
      colliders.push({
        center: new Vector3(
          center.x + Math.cos(swirl) * radius,
          waistY + cageSpan * h,
          center.z + Math.sin(swirl) * radius,
        ),
        radius: 1.1,
      });
    }

    // A fan seat or two on the outer face of every third rib.
    if (ribIndex % 3 === 0) {
      const h = random.range(0.3, 0.6);
      const radius = ribRadius(h) + depth / 2;
      const swirl = theta + h * 0.35;
      fanAnchors.push({
        pos: [
          center.x + Math.cos(swirl) * radius,
          waistY + cageSpan * h,
          center.z + Math.sin(swirl) * radius,
        ],
        normal: [Math.cos(swirl), 0, Math.sin(swirl)],
      });
    }
  }

  // ── The crown finial ───────────────────────────────────────────────
  {
    const SIDES = 12;
    const LEVELS = 4;
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let j = 0; j <= LEVELS; j++) {
      const h = j / LEVELS;
      const y = top - 1.6 + 2.6 * h;
      const radius = 1.5 * Math.sin(Math.PI * (0.15 + 0.85 * (1 - h) * 0.5)) + 0.1;
      for (let s = 0; s <= SIDES; s++) {
        const a = (s / SIDES) * Math.PI * 2;
        positions.push(center.x + Math.cos(a) * radius, y, center.z + Math.sin(a) * radius);
        colors.push(1.04, 1.03, 1.08);
        uvs.push((s / SIDES) * 1.6, h * 0.45);
      }
    }
    for (let j = 0; j < LEVELS; j++) {
      for (let s = 0; s < SIDES; s++) {
        const a = j * (SIDES + 1) + s;
        const b = a + SIDES + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(indices);
    parts.push(geometry);
  }

  const chalk = createToonMaterial({ map: chalkTexture(), color: 0xf6efdd, vertexColors: true });
  const body = mergedMesh(parts, chalk, "pale2-lamp");

  // ── The heart: the light itself ────────────────────────────────────
  // An apex-lit ovoid whose vertex colours SHAPE the emissive (the
  // glow-colony chunk at landmark scale). Intensity stays far under
  // the bloom pass's 0.82.
  const heartY = waistY + cageSpan * 0.42;
  const heart = buildHeart(center.x, heartY, center.z);

  // The foot is solid; the heart is not walled (swimming to the light
  // is the point — the chamber is the reward).
  colliders.push(
    { center: new Vector3(center.x, ground + 1.2, center.z), radius: 5.2 },
    { center: new Vector3(center.x, ground + 4.2, center.z), radius: 3.6 },
  );
  contacts.push({ x: center.x, z: center.z, radius: 9, strength: 0.4 });

  // Interior glow garden anchors, on the chamber floor around the foot.
  const glowRandom = new Random(SEED ^ 0x0c02);
  for (let i = 0; i < 5; i++) {
    const a = glowRandom.range(0, Math.PI * 2);
    const r = glowRandom.range(4.6, 6.4);
    const gx = center.x + Math.cos(a) * r;
    const gz = center.z + Math.sin(a) * r;
    glowAnchors.push([gx, pale2TerrainTarget(gx, gz) + 0.15, gz]);
  }

  const mouthR = ribRadius(0.42);
  const mouth = {
    x: center.x + Math.cos(mouthTheta) * mouthR,
    y: heartY,
    z: center.z + Math.sin(mouthTheta) * mouthR,
    facing: mouthTheta,
  };

  return {
    meshes: [body, heart],
    colliders,
    contacts,
    fanAnchors,
    glowAnchors,
    mouth,
    heart: { x: center.x, y: heartY, z: center.z },
  };
}

/** The emissive chunk the canyon polyps proved: light wears the tint. */
const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

function buildHeart(x: number, y: number, z: number): Mesh {
  const SIDES = 16;
  const LEVELS = 10;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const H = 3.4;
  const R = 2.0;
  for (let j = 0; j <= LEVELS; j++) {
    const h = j / LEVELS;
    const y0 = y - H / 2 + H * h;
    const radius = R * Math.sin(Math.PI * (0.06 + 0.88 * h)) + 0.08;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(x + Math.cos(a) * radius, y0, z + Math.sin(a) * radius);
      // Round 3: rekeyed — r2's bottom-dark gradient showed the lamp-
      // heart pose (which looks UP at it) a flat tan ball. The body
      // now holds a bright base everywhere with a soft apex lift, so
      // it reads as a light from every angle.
      const t = smoothstep01((h - 0.25) / 0.7);
      const value = 0.56 + 0.44 * t;
      colors.push(value, value * 0.88, value * 0.66);
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Round 5: cap both poles. The lathe profile starts at r ≈ 0.46, and
  // the open bottom hole read as a bright water-blue ellipse from the
  // lamp-heart pose (which looks straight up through it).
  const bottomCenter = positions.length / 3;
  positions.push(x, y - H / 2, z);
  colors.push(0.56, 0.56 * 0.88, 0.56 * 0.66);
  const topCenter = positions.length / 3;
  positions.push(x, y + H / 2, z);
  colors.push(1, 0.88, 0.66);
  for (let s = 0; s < SIDES; s++) {
    indices.push(bottomCenter, s, s + 1);
    const t = LEVELS * (SIDES + 1) + s;
    indices.push(topCenter, t + 1, t);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = createToonMaterial({ color: 0xf6e2b8, vertexColors: true });
  material.emissive = new Color(0xffd9a0);
  material.emissiveIntensity = 0.62;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };

  const mesh = new Mesh(geometry, material);
  mesh.name = "pale2-lamp-heart";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
