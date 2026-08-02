import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GroundFn, KitBuild } from "./KitTypes";
import { finishBuild } from "./KitGroundShared";

/**
 * `matRings` — KIT-SPEC §2.4. The banded-disc BUILDER: rim-banded mats
 * draped to the caller's ground. The builder is kit; the tiered
 * amber/rust/sinter palette is smoking-1's exclusive signature and
 * white-felt/rust is calamity's (MASTER R8) — bands are parameters here,
 * never baked in.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw** (all discs
 * merged); (4 × bands + 1) × segments triangles per disc — 156 tris for a
 * three-band mat at the base 12 segments. A step over the spec's ~24–40
 * sketch, flagged in the package ledger: two rings per band (flat painted
 * interiors, short blends between bands) is the fewest that read as BANDS
 * rather than one airbrushed blob (measured, captures a-r1/r2), and a
 * region wears a handful of mats, not hundreds. Tiers multiply discs,
 * not draws.
 *
 * Paint (law 3): bands live in vertex colour (they ARE the palette
 * parameter), blending painterly across each annulus, and the outermost
 * band dissolves to zero alpha at the rim — no hard edge to minify into a
 * ring artefact (the pool-rim lesson). Every band edge wanders on a seeded
 * fbm so no mat is a compass circle.
 */

export interface MatBand {
  /** sRGB hex, centre→rim order. */
  readonly color: number;
  /** Relative width; widths are normalised onto each anchor's radius. */
  readonly width: number;
}

export interface MatAnchor {
  readonly pos: readonly [number, number];
  readonly radius: number;
}

export interface MatRingsOptions {
  readonly seed: number;
  /** Centre→rim band table. The last band is the fade-out skirt. */
  readonly bands: readonly MatBand[];
  readonly ground: GroundFn;
  readonly anchors: readonly MatAnchor[];
  /** Stacked tiers per anchor (sinter terraces). Default 1. */
  readonly tiers?: number;
}

/**
 * Metres the mat floats over the ground sampler. Sized against the seabed
 * sheets' ~0.9 m grid: a coarse draped disc interpolates differently from
 * the fine sand mesh, and at 0.04 the sand's bilinear crests cut hard
 * edges through the mat (measured, capture a-r1).
 */
const DRAPE_LIFT = 0.1;

/** Each tier shrinks to this share of the one below and steps up a little. */
const TIER_SHRINK = 0.58;
const TIER_RISE = 0.16;

export function buildMatRings(options: MatRingsOptions): KitBuild {
  if (options.bands.length < 2) {
    throw new Error("matRings: at least two bands (a heart and a rim skirt)");
  }
  const random = new Random(options.seed);
  const tiers = Math.max(1, Math.round(options.tiers ?? 1));

  const discs: BufferGeometry[] = [];
  for (const anchor of options.anchors) {
    for (let tier = 0; tier < tiers; tier++) {
      const radius = anchor.radius * Math.pow(TIER_SHRINK, tier);
      const rise = TIER_RISE * tier * anchor.radius;
      // One fresh wobble seed per disc, drawn from the piece's own stream.
      const wobbleSeed = Math.floor(random.next() * 0xffff_ffff);
      discs.push(
        discGeometry(options.bands, options.ground, anchor, radius, rise, wobbleSeed),
      );
    }
  }

  const merged = mergeGeometries(discs, false);
  for (const disc of discs) {
    disc.dispose();
  }
  if (!merged) {
    throw new Error("matRings: discs could not be merged");
  }
  merged.computeBoundingSphere();

  const material: Material = createToonMaterial({
    vertexColors: true,
    transparent: true,
  });
  // A mat is a decal on the ground: it must never occlude what stands over
  // it through its dissolving rim.
  material.depthWrite = false;

  const mesh = new Mesh(merged, material);
  mesh.name = "kit-mat-rings";
  const group = new Group();
  group.name = "kit-mat-rings";
  group.add(mesh);
  return finishBuild(group, [merged, material]);
}

/**
 * One draped disc: a centre fan and one wandered ring per band edge, RGBA
 * vertex colours carrying the band table, alpha 1 everywhere except the rim
 * ring where it dissolves to 0.
 */
function discGeometry(
  bands: readonly MatBand[],
  ground: GroundFn,
  anchor: MatAnchor,
  radius: number,
  rise: number,
  wobbleSeed: number,
): BufferGeometry {
  const segments = Math.max(12, Math.min(18, Math.round(8 + radius * 2.5)));
  const totalWidth = bands.reduce((sum, band) => sum + band.width, 0);

  // TWO rings per band, at 18% and 82% of its width, so each band holds a
  // flat painted interior and the blends live in the short spans between
  // neighbouring bands — one ring per band read as one airbrushed blob
  // (captures a-r1/r2). The extra rim ring is where the alpha dissolves.
  const edges: number[] = [];
  let acc = 0;
  for (const band of bands) {
    edges.push(((acc + band.width * 0.18) / totalWidth) * radius);
    edges.push(((acc + band.width * 0.82) / totalWidth) * radius);
    acc += band.width;
  }
  edges.push(radius);

  const rings = edges.length;
  const vertexCount = 1 + rings * segments;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 4);
  const indices: number[] = [];
  const [cx, cz] = anchor.pos;

  const heart = new Color(bands[0]!.color);
  positions[0] = cx;
  positions[1] = ground(cx, cz) + DRAPE_LIFT + rise;
  positions[2] = cz;
  colors[0] = heart.r;
  colors[1] = heart.g;
  colors[2] = heart.b;
  colors[3] = 1;

  const bandColor = new Color();
  for (let ringIndex = 0; ringIndex < rings; ringIndex++) {
    const edge = edges[ringIndex]!;
    const isRim = ringIndex === rings - 1;
    bandColor.setHex(bands[Math.min(ringIndex >> 1, bands.length - 1)]!.color);
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      // The wander: band edges undulate together on one seeded field, so a
      // mat's rings stay concentric while none is a ruled circle.
      const wobble =
        1 +
        (fbm(s / segments, ringIndex * 0.21 + 0.13, {
          seed: wobbleSeed,
          period: 3,
          octaves: 2,
        }) -
          0.5) *
          0.22;
      const r = edge * wobble;
      const x = cx + Math.cos(theta) * r;
      const z = cz + Math.sin(theta) * r;
      const vertex = 1 + ringIndex * segments + s;
      positions[vertex * 3] = x;
      positions[vertex * 3 + 1] = ground(x, z) + DRAPE_LIFT + rise;
      positions[vertex * 3 + 2] = z;
      colors[vertex * 4] = bandColor.r;
      colors[vertex * 4 + 1] = bandColor.g;
      colors[vertex * 4 + 2] = bandColor.b;
      colors[vertex * 4 + 3] = isRim ? 0 : 1;
    }
  }

  // The centre fan; wound so the face normal points up out of the ground.
  for (let s = 0; s < segments; s++) {
    indices.push(0, 1 + ((s + 1) % segments), 1 + s);
  }
  // The annuli.
  for (let ringIndex = 0; ringIndex + 1 < rings; ringIndex++) {
    const inner = 1 + ringIndex * segments;
    const outer = inner + segments;
    for (let s = 0; s < segments; s++) {
      const next = (s + 1) % segments;
      indices.push(inner + s, inner + next, outer + s);
      indices.push(inner + next, outer + next, outer + s);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
