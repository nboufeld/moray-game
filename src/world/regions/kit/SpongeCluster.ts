import {
  BufferAttribute,
  Color,
  Group,
  LatheGeometry,
  Vector2,
  type BufferGeometry,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GroundFn, KitBuild, KitPalette } from "./KitTypes";
import { finishBuild, instantiatePlacements, type KitPlacement } from "./KitGroundShared";

/**
 * `spongeCluster` — KIT-SPEC §2.6. The W-N5 tube-sponge profile verbatim:
 * long, narrow, walls near parallel, a trumpet only in the last sixth, and
 * 3–5 staggered tubes per holdfast so the cluster carries the silhouette
 * separation the old flare used to buy.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw**; 180
 * triangles per tube — 6 anchors × 4 tubes ≈ 4.3k tris.
 *
 * The profile and {@link paintTube} are PORTED from `CoralShapes`'
 * `tubeGeometry` (spec §2.6: "port `paintTube`, do not reinvent it" —
 * both are module-private there, so the port is a verbatim copy with the
 * source cited): exterior ceiling 0.9 at the lip so the rim is never the
 * brightest ring in the frame, throat leaning hard into red and deepening
 * — living tissue over a dim interior. The instance colour stays the one
 * hue source; the throat warmth multiplies it and can never exceed the
 * vertex-colour ceiling.
 */

export interface SpongeAnchor {
  readonly pos: readonly [number, number];
}

export interface SpongeClusterOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly ground: GroundFn;
  readonly anchors: readonly SpongeAnchor[];
  /** Tubes per holdfast, staggered. Default 4 (the W-N5 3–5 band). */
  readonly tubesPerAnchor?: number;
  /** Tall-tube height in metres; siblings stagger below it. Default 1.15. */
  readonly height?: number;
}

/** How far a sibling tube stands from its holdfast's centre, metres. */
const HOLDFAST_RADIUS = 0.32;

export function buildSpongeCluster(options: SpongeClusterOptions): KitBuild {
  const random = new Random(options.seed);
  const tubesPerAnchor = Math.max(1, Math.round(options.tubesPerAnchor ?? 4));
  const height = options.height ?? 1.15;

  const geometry = tubeGeometry();
  const material = createToonMaterial({ vertexColors: true });

  const base = new Color(options.palette.base);
  const accent = new Color(options.palette.accent ?? options.palette.base);
  const color = new Color();
  const parts: KitPlacement[] = [];
  for (const anchor of options.anchors) {
    for (let i = 0; i < tubesPerAnchor; i++) {
      // Staggered around the holdfast: even spacing plus seeded slip, so a
      // cluster reads as one animal's colony rather than a scatter.
      const around = (i / tubesPerAnchor) * Math.PI * 2 + random.signed(0.6);
      const out = i === 0 ? 0 : HOLDFAST_RADIUS * random.range(0.55, 1.1);
      const x = anchor.pos[0] + Math.cos(around) * out;
      const z = anchor.pos[1] + Math.sin(around) * out;
      // Staggered heights are the cluster's whole silhouette read.
      const tall = height * (i === 0 ? random.range(0.95, 1.15) : random.range(0.5, 0.9));
      const girth = tall * random.range(0.85, 1.05);
      // Outer tubes lean a touch away from the holdfast's heart.
      const lean = i === 0 ? 0 : random.range(0.05, 0.16);
      const accentRoll = random.next();
      parts.push({
        x,
        y: options.ground(x, z) - 0.03,
        z,
        rotation: [Math.sin(around) * -lean, random.range(0, Math.PI * 2), Math.cos(around) * lean],
        scale: [girth, tall, girth],
        color: color
          .copy(accentRoll < 0.25 ? accent : base)
          .multiplyScalar(random.range(0.9, 1.08))
          .clone(),
      });
    }
  }

  const mesh = instantiatePlacements(geometry, material, parts, "kit-sponge-cluster");
  const group = new Group();
  group.name = "kit-sponge-cluster";
  group.add(mesh);
  return finishBuild(group, [geometry, material]);
}

/**
 * The W-N5 sponge lathe, ported from `CoralShapes.tubeGeometry`: the
 * profile climbs the outside, turns over the rim and runs back down the
 * inside far enough that the shade band inside it is visible before the
 * floor closes it off. Nine segments around — the mouth's ellipse is the
 * only place the count is legible, and nine reads as round once smooth.
 * Normalised to unit height with the foot at y = 0.
 */
function tubeGeometry(): BufferGeometry {
  const profile = [
    new Vector2(0.0, 0.015),
    new Vector2(0.115, 0.0),
    new Vector2(0.105, 0.3),
    new Vector2(0.112, 0.55),
    new Vector2(0.125, 0.8),
    new Vector2(0.145, 0.94),
    new Vector2(0.16, 1.0),
    // Over the rim, and back down the throat.
    new Vector2(0.112, 0.965),
    new Vector2(0.085, 0.72),
    new Vector2(0.07, 0.45),
    new Vector2(0.0, 0.4),
  ];
  /** Where the profile turns over the rim: everything past it is throat. */
  const lipIndex = 6;
  const geometry = new LatheGeometry(profile, 9);
  undulateWall(geometry, profile.length, lipIndex);
  paintTube(geometry, profile.length, lipIndex);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The living wall (R12): a sponge at arm's length is lumpy tissue, and the
 * clean lathe read as terracotta pipe in the q-r1 close capture. Exterior
 * vertices breathe in and out by a few percent on a seeded fbm keyed to
 * angle-and-height, seam column included twice at the same angle so the
 * wrap stays welded; the throat stays clean (it reads as depth, and lumps
 * inside a dark mouth are noise). Same topology — 180 tris holds.
 */
function undulateWall(geometry: BufferGeometry, pointCount: number, lipIndex: number): void {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!position || !uv) {
    return;
  }
  for (let i = 0; i < position.count; i++) {
    const index = uv.getY(i) * (pointCount - 1);
    if (index > lipIndex + 0.5) {
      continue; // the throat stays a clean bore
    }
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = position.getY(i);
    const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const swell = 1 + (fbm(angle, y * 1.6, { seed: 0x5b0a_9e, period: 5, octaves: 2 }) - 0.5) * 0.17;
    position.setX(i, x * swell);
    position.setZ(i, z * swell);
  }
  (position as BufferAttribute).needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * The sponge's vertex paint, ported verbatim from `CoralShapes.paintTube`
 * and keyed off the lathe's own profile index — a lathe writes
 * `uv.y = j / (points - 1)`, so inside and outside are exact, not guessed
 * from normals. No cream rim; a warm throat that deepens going down.
 */
function paintTube(geometry: BufferGeometry, pointCount: number, lipIndex: number): void {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!position || !uv) {
    return;
  }
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const index = uv.getY(i) * (pointCount - 1);
    const height = position.getY(i);
    if (index <= lipIndex + 0.5) {
      const value = Math.pow(0.7 + height * 0.2, 2.2);
      colors[i * 3] = value;
      colors[i * 3 + 1] = value * 0.97;
      colors[i * 3 + 2] = value * 0.92;
    } else {
      const depth = (index - lipIndex) / (pointCount - 1 - lipIndex);
      const value = Math.pow(0.8 - depth * 0.42, 2.2);
      colors[i * 3] = value;
      colors[i * 3 + 1] = value * (0.72 - depth * 0.1);
      colors[i * 3 + 2] = value * (0.55 - depth * 0.1);
    }
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}
