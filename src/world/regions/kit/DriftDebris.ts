import {
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  PlaneGeometry,
  Vector2,
  type BufferGeometry,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GateFn, GroundFn, KitArea, KitBuild, KitPalette } from "./KitTypes";
import {
  finishBuild,
  groundLie,
  mergeBakedPlacements,
  scatterPoints,
  shadeRatio,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `driftDebris` — KIT-SPEC §2.8. Wrack curls, spar lengths, plank slabs,
 * and the story-neutral relic family. Never colliders (law 1: the kit
 * registers nothing).
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw per shape
 * family** (one per call, merged world-space — variants inside a family
 * are the point, and an InstancedMesh carries one geometry). Triangles per
 * item: wrack 10, spars 10, planks 12, relics 48–80; a 40-piece wrack
 * drift ≈ 400 tris, a 12-relic scatter ≈ 850.
 *
 * The relic family — quern, bowl, tile, drum fragment — is the calamity
 * handshake: wreckage a player RECOGNISES. The drum fragment restates the
 * ruins-terrace wing's own column drum (`RuinsTerraceFlora.
 * brokenDrumGeometry`: barrel radius 0.42–0.47 with the fbm-jagged broken
 * crown); the wing publishes no tile constants, so the tile takes the same
 * stone's proportions at hand scale — flagged in the package ledger.
 *
 * Paint (law 3): silvered tops (full value, a whisper cooler) over
 * undersides shaded toward the palette's `shade` — a colour, never black.
 * Relics take a `mossTint` knob: an up-facing blotch pass in the given
 * green, the `mossFaces` discipline restated.
 */

export type DebrisShapeSet =
  | "wrack"
  | "spars"
  | "planks"
  | "relics"
  | readonly BufferGeometry[];

export interface DriftDebrisOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly area: KitArea;
  readonly gate: GateFn;
  readonly ground: GroundFn;
  readonly count: number;
  readonly shapeSet: DebrisShapeSet;
  /** Relic moss: sRGB hex the up-facing blotches lean toward. */
  readonly mossTint?: number;
}

/** Fallback underside shade: cool violet-grey, never black. */
const DEFAULT_UNDER = 0x6e6880;

export function buildDriftDebris(options: DriftDebrisOptions): KitBuild {
  const random = new Random(options.seed);

  const underRatio = shadeRatio(
    options.palette.base,
    options.palette.shade ?? DEFAULT_UNDER,
  );

  // Variants from the piece's own sub-stream, so a count retune never
  // re-carves a shape.
  const builtIn = typeof options.shapeSet === "string";
  const variants: readonly BufferGeometry[] =
    typeof options.shapeSet === "string"
      ? builtInFamily(
          options.shapeSet,
          new Random(options.seed ^ 0x9e37_79b9),
          underRatio,
          options.mossTint,
        )
      : options.shapeSet;

  const spots = scatterPoints({
    random,
    area: options.area,
    gate: options.gate,
    count: options.count,
    // Drift lines: debris strands together where the current dropped it.
    looseShare: 0.25,
    perClump: 9,
    clumpRadius: 1.4,
  });

  const color = new Color(options.palette.base);
  const tone = new Color();
  const placements: KitPlacement[] = [];
  const picks: number[] = [];
  for (const spot of spots) {
    const pick = Math.min(variants.length - 1, Math.floor(random.next() * variants.length));
    const yaw = random.range(0, Math.PI * 2);
    const size = random.range(0.8, 1.3);
    const lie = groundLie(options.ground, spot.x, spot.z);
    placements.push({
      x: spot.x,
      y: options.ground(spot.x, spot.z) + 0.01,
      z: spot.z,
      rotation: [lie.pitch + random.signed(0.08), yaw, lie.roll + random.signed(0.08)],
      scale: [size * random.range(0.9, 1.15), size, size * random.range(0.9, 1.15)],
      color: tone.copy(color).multiplyScalar(random.range(0.84, 1.06)).clone(),
    });
    picks.push(pick);
  }

  const merged = mergeBakedPlacements(variants, placements, picks);
  if (builtIn) {
    for (const variant of variants) {
      variant.dispose();
    }
  }

  const material = createToonMaterial({ vertexColors: true, side: DoubleSide });
  const mesh = new Mesh(merged, material);
  mesh.name = "kit-drift-debris";
  const group = new Group();
  group.name = "kit-drift-debris";
  group.add(mesh);
  return finishBuild(group, [merged, material]);
}

/** The four built-in families, each painted silver-top / shade-under. */
function builtInFamily(
  family: "wrack" | "spars" | "planks" | "relics",
  random: Random,
  underRatio: readonly [number, number, number],
  mossTint: number | undefined,
): BufferGeometry[] {
  let variants: BufferGeometry[];
  switch (family) {
    case "wrack": {
      // Gentle curls, squashed low: a-r2's 2.4–4.1 rad curls stood on the
      // sand like croquet hoops — wrack LIES, with lifted ends.
      variants = [
        wrackCurl(0.55, 1.1, random.next()),
        wrackCurl(0.78, 1.7, random.next()),
        wrackCurl(0.64, 2.2, random.next()),
      ];
      for (const variant of variants) {
        variant.scale(1, 0.55, 1);
        variant.computeVertexNormals();
      }
      break;
    }
    case "spars": {
      variants = [sparLength(0.9, 0.028), sparLength(1.3, 0.035), sparLength(0.6, 0.022)];
      break;
    }
    case "planks": {
      variants = [
        new BoxGeometry(0.9, 0.05, 0.16),
        new BoxGeometry(1.25, 0.05, 0.2),
        new BoxGeometry(0.55, 0.04, 0.14),
      ];
      break;
    }
    case "relics": {
      variants = [
        drumFragment(Math.floor(random.next() * 0xffff)),
        quernStone(),
        bowlShell(),
        roofTile(),
      ];
      break;
    }
    default: {
      const exhaustive: never = family;
      throw new Error(`driftDebris: unknown shape set ${String(exhaustive)}`);
    }
  }
  for (const variant of variants) {
    paintSilverUnder(variant, underRatio);
    if (family === "relics" && mossTint !== undefined) {
      mossBlotch(variant, mossTint);
    }
  }
  return variants;
}

/**
 * A wrack curl: a tapered strap whose bend angle integrates past a half
 * turn, so both ends lift off the sand — a frond the current rolled up.
 * 10 triangles.
 */
function wrackCurl(length: number, curlTo: number, slip: number): BufferGeometry {
  const segments = 5;
  const width = length * 0.22;
  const geometry = new PlaneGeometry(width, length, 1, segments);
  const position = geometry.attributes.position as BufferAttribute;

  const rows = segments + 1;
  const arcX = new Float32Array(rows);
  const arcY = new Float32Array(rows);
  const step = length / segments;
  let x = 0;
  let y = 0.02;
  for (let row = 0; row < rows; row++) {
    arcX[row] = x;
    arcY[row] = y;
    const angle = -0.15 + curlTo * Math.pow((row + 0.5) / segments, 1.35 + slip * 0.4);
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
  }

  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) / length + 0.5;
    const row = Math.round(t * segments);
    const across = position.getX(i) * (1 - t * 0.45);
    position.setXYZ(i, arcX[row] ?? 0, Math.max(0.01, arcY[row] ?? 0), across);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** A drift spar: an open tapered rod lying along +x. 10 triangles. */
function sparLength(length: number, radius: number): BufferGeometry {
  const geometry = new CylinderGeometry(radius * 0.7, radius, length, 5, 1, true);
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(0, radius, 0);
  return geometry;
}

/**
 * The drum fragment: the ruins-terrace column drum's barrel — radius
 * 0.42–0.47, the fbm-jagged broken crown — cut to a hand-height fragment
 * and lying on its side. 64 triangles at 8 segments.
 */
function drumFragment(seed: number): BufferGeometry {
  const profile = [
    new Vector2(0, -0.02),
    new Vector2(0.42, -0.02),
    new Vector2(0.45, 0.12),
    new Vector2(0.47, 0.38),
    new Vector2(0.44, 0.55),
    new Vector2(0, 0.55),
  ];
  const geometry = new LatheGeometry(profile, 8);
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y <= 0.34) {
      continue;
    }
    // The broken crown, the wing's own noise-read-by-direction trick.
    const u = Math.atan2(position.getZ(i), position.getX(i)) / (Math.PI * 2) + 0.5;
    const jag = fbm(u, 0.5, { seed: seed ^ 0x77, period: 3, octaves: 2 });
    position.setY(i, y - jag * 0.28 * ((y - 0.34) / 0.21));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  // Lying on its side, half sunk in its own footprint.
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(0, 0.36, 0);
  geometry.scale(0.75, 0.75, 0.75);
  return geometry;
}

/** The quern: a squat pierced millstone — a domestic life, story-neutral. */
function quernStone(): BufferGeometry {
  const profile = [
    new Vector2(0.07, 0.12),
    new Vector2(0.1, 0.13),
    new Vector2(0.3, 0.11),
    new Vector2(0.33, 0.05),
    new Vector2(0.32, 0),
    new Vector2(0.05, 0),
  ];
  const geometry = new LatheGeometry(profile, 9);
  geometry.computeVertexNormals();
  return geometry;
}

/** The bowl: a thin shell over the rim and back down, mouth up. */
function bowlShell(): BufferGeometry {
  const profile = [
    new Vector2(0.0, 0.015),
    new Vector2(0.12, 0.02),
    new Vector2(0.2, 0.08),
    new Vector2(0.23, 0.16),
    new Vector2(0.2, 0.15),
    new Vector2(0.17, 0.09),
    new Vector2(0.0, 0.045),
  ];
  const geometry = new LatheGeometry(profile, 9);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The tile: a cambered rectangle at hand scale — the wing publishes no
 * tile constants (ledger flag), so it takes the terrace stone's own
 * proportions. 8 triangles.
 */
function roofTile(): BufferGeometry {
  const geometry = new PlaneGeometry(0.34, 0.26, 4, 1);
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const across = position.getX(i) / 0.17;
    position.setXYZ(
      i,
      position.getX(i),
      0.05 * (1 - across * across) + 0.012,
      position.getY(i),
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Silvered top, shade-colour underside, keyed off the piece's normals. */
function paintSilverUnder(
  geometry: BufferGeometry,
  underRatio: readonly [number, number, number],
): void {
  const position = geometry.attributes.position as BufferAttribute;
  const normal = geometry.attributes.normal as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const up = normal.getY(i) * 0.5 + 0.5;
    const t = up * up * (3 - 2 * up);
    // The silver: full value on top with red eased a whisper, so driftwood
    // and old stone read bleached rather than warm.
    const silver: readonly [number, number, number] = [0.96, 0.99, 1.0];
    colors[i * 3] = underRatio[0] + (silver[0] - underRatio[0]) * t;
    colors[i * 3 + 1] = underRatio[1] + (silver[1] - underRatio[1]) * t;
    colors[i * 3 + 2] = underRatio[2] + (silver[2] - underRatio[2]) * t;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * The relic moss knob: up-facing blotches multiplied toward the given
 * tint — the `mossFaces` discipline restated against a caller hue, only
 * ever darkening channels that the tint sits under.
 */
function mossBlotch(geometry: BufferGeometry, tintHex: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  const normal = geometry.attributes.normal as BufferAttribute;
  const colors = geometry.attributes.color as BufferAttribute;
  const tint = new Color(tintHex);
  for (let i = 0; i < position.count; i++) {
    const up = Math.max(0, normal.getY(i));
    if (up <= 0) {
      continue;
    }
    const blotch = fbm(position.getX(i) * 1.6 + 0.5, position.getZ(i) * 1.6 + 0.5, {
      seed: 0x0b10,
      period: 3,
      octaves: 2,
    });
    const moss = Math.pow(up, 1.4) * Math.min(1, Math.max(0, (blotch - 0.34) / 0.4));
    if (moss <= 0) {
      continue;
    }
    colors.setXYZ(
      i,
      colors.getX(i) * (1 + (Math.min(1, tint.r) - 1) * moss),
      colors.getY(i) * (1 + (Math.min(1, tint.g * 1.08) - 1) * moss),
      colors.getZ(i) * (1 + (Math.min(1, tint.b) - 1) * moss),
    );
  }
  colors.needsUpdate = true;
}
