import {
  BufferAttribute,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  OctahedronGeometry,
  type BufferGeometry,
  type Material,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GateFn, GroundFn, KitArea, KitBuild, KitPalette } from "./KitTypes";
import {
  angleTo,
  finishBuild,
  groundLie,
  instantiatePlacements,
  mergeBakedPlacements,
  scatterPoints,
  shadeRatio,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `groundLitter` — KIT-SPEC §2.2. Gravel, scree and shard runs, cinder and
 * scoria drifts, pebble aprons: small stones lying ON the caller's ground
 * with seeded tilt, the Reef `buildRubble` scatter idiom generalised.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw per tone
 * family** (2 with `twoTone`); 8–20 triangles per built-in instance
 * (gravel/pebble 20, shard/grit 8), so 600 stones ≈ 12k tris worst case.
 * Caller shape sets (pale-1's ossuary fragments — MASTER R8) carry their
 * own triangle bill and bake as ONE merged draw per tone family.
 *
 * The `rake` knob aligns instance yaw radially AWAY from a world point —
 * calamity's blast alignment; region tests sample yaws and assert the
 * alignment ± tolerance, so the local +x axis is the contractual "away"
 * direction and raked instances elongate along it.
 *
 * Paint (law 3): top faces at the instance hue, undersides taken down to
 * the palette's `shade` — a colour, never black — keyed off the geometry's
 * own normals so a tumbled stone still shades toward the sand it sits on.
 */

export type LitterShapeSet =
  | "gravel"
  | "shard"
  | "pebble"
  | "grit"
  | readonly BufferGeometry[];

export interface GroundLitterOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly area: KitArea;
  readonly gate: GateFn;
  readonly ground: GroundFn;
  readonly count: number;
  /** Built-in stone family, or caller geometry for exclusive shapes (R8). */
  readonly shapeSet?: LitterShapeSet;
  /** Base radius envelope in metres, [min, max). */
  readonly size?: readonly [number, number];
  /** Blast alignment: yaw turned radially away from `from` by `strength`. */
  readonly rake?: {
    readonly from: readonly [number, number];
    readonly strength: number;
    readonly jitter: number;
  };
  /** Splits the scatter into two instance-colour families (2 draws). */
  readonly twoTone?: boolean;
}

const DEFAULT_SIZES: Record<"gravel" | "shard" | "pebble" | "grit", readonly [number, number]> = {
  gravel: [0.05, 0.16],
  shard: [0.07, 0.22],
  pebble: [0.06, 0.18],
  grit: [0.02, 0.07],
};

/** Fallback underside when the palette brings no shade: violet-grey dusk. */
const DEFAULT_UNDER = 0x746d80;

export function buildGroundLitter(options: GroundLitterOptions): KitBuild {
  const random = new Random(options.seed);
  const shapeSet = options.shapeSet ?? "gravel";
  const builtIn = typeof shapeSet === "string";
  const size: readonly [number, number] =
    options.size ?? (builtIn ? DEFAULT_SIZES[shapeSet] : [0.8, 1.2]);

  const underRatio = shadeRatio(
    options.palette.base,
    options.palette.shade ?? DEFAULT_UNDER,
  );

  const spots = scatterPoints({
    random,
    area: options.area,
    gate: options.gate,
    count: options.count,
    perClump: 18,
  });

  // Tone families: the base hue and a second family on the accent (or the
  // shade) so a run reads as mixed rock rather than one pour. Every stream
  // draw below happens for every instance whether twoTone is on or not, so
  // switching the option can never shift a survivor's pose.
  const toneA = new Color(options.palette.base);
  const toneB = new Color(
    options.palette.accent ?? options.palette.shade ?? options.palette.base,
  );
  if (options.palette.accent === undefined && options.palette.shade === undefined) {
    toneB.multiplyScalar(0.82);
  }

  const color = new Color();
  const families: { placements: KitPlacement[]; picks: number[] }[] = [
    { placements: [], picks: [] },
    { placements: [], picks: [] },
  ];
  const variantCount = builtIn ? 1 : shapeSet.length;

  for (const spot of spots) {
    const freeYaw = random.range(0, Math.PI * 2);
    const family = random.next() < 0.5 ? 0 : 1;
    const pick = Math.min(variantCount - 1, Math.floor(random.next() * variantCount));
    const base = random.range(size[0], size[1]);
    const stretchX = random.range(0.75, 1.3);
    const stretchZ = random.range(0.75, 1.3);
    const flatten = random.range(0.4, 0.7);
    const tone = random.range(0.85, 1.1);
    const rollTilt = random.signed(0.14);
    const pitchTilt = random.signed(0.14);
    const rakeJitter = random.signed(options.rake?.jitter ?? 0);

    let yaw = freeYaw;
    let elongate = 1;
    if (options.rake) {
      // Radially AWAY: local +x must land on the outward radial. A rotation
      // about y by `a` maps +x to (cos a, 0, -sin a), hence the negation.
      const away = Math.atan2(
        spot.z - options.rake.from[1],
        spot.x - options.rake.from[0],
      );
      yaw = freeYaw + angleTo(freeYaw, -away) * options.rake.strength + rakeJitter;
      elongate = 1 + options.rake.strength * 0.9;
    }

    const lie = groundLie(options.ground, spot.x, spot.z);
    const familyBucket = options.twoTone === true ? family : 0;
    families[familyBucket]!.placements.push({
      x: spot.x,
      y: options.ground(spot.x, spot.z) + base * flatten * 0.35 - 0.02,
      z: spot.z,
      rotation: [lie.pitch + pitchTilt, yaw, lie.roll + rollTilt],
      scale: [base * stretchX * elongate, base * flatten, base * stretchZ],
      color: color
        .copy(familyBucket === 0 ? toneA : toneB)
        .multiplyScalar(tone)
        .clone(),
    });
    families[familyBucket]!.picks.push(pick);
  }

  const group = new Group();
  group.name = "kit-ground-litter";
  const owned: (BufferGeometry | Material)[] = [];
  const material = createToonMaterial({ vertexColors: true });
  owned.push(material);

  if (builtIn) {
    const geometry = builtInStone(shapeSet, options.seed, underRatio);
    owned.push(geometry);
    for (const [index, familyParts] of families.entries()) {
      if (familyParts.placements.length === 0) {
        continue;
      }
      group.add(
        instantiatePlacements(
          geometry,
          material,
          familyParts.placements,
          `kit-ground-litter-${index}`,
        ),
      );
    }
  } else {
    // Caller geometry: exclusive shapes bake as one merged world-space draw
    // per tone family (the AbyssFlora idiom) — an InstancedMesh carries one
    // geometry, and a shape FAMILY is the whole point of the option.
    for (const [index, familyParts] of families.entries()) {
      if (familyParts.placements.length === 0) {
        continue;
      }
      const merged = mergeBakedPlacements(shapeSet, familyParts.placements, familyParts.picks);
      owned.push(merged);
      const mesh = new Mesh(merged, material);
      mesh.name = `kit-ground-litter-${index}`;
      group.add(mesh);
    }
  }

  return finishBuild(group, owned);
}

/** One built-in stone at base radius 0.5, painted top-lift / under-shade. */
function builtInStone(
  kind: "gravel" | "shard" | "pebble" | "grit",
  seed: number,
  underRatio: readonly [number, number, number],
): BufferGeometry {
  let geometry: BufferGeometry;
  switch (kind) {
    case "gravel": {
      geometry = new IcosahedronGeometry(0.5, 0);
      displace(geometry, seed, 0.3);
      smoothNormals(geometry);
      break;
    }
    case "pebble": {
      geometry = new IcosahedronGeometry(0.5, 0);
      displace(geometry, seed, 0.12);
      geometry.scale(1, 0.75, 0.88);
      smoothNormals(geometry);
      break;
    }
    case "shard": {
      // Faceted on purpose: a shard's read IS its edges. Stretched along
      // +x so a raked run shows its alignment.
      geometry = new OctahedronGeometry(0.5, 0);
      displace(geometry, seed, 0.18);
      geometry.scale(1.5, 0.55, 0.8);
      break;
    }
    case "grit": {
      geometry = new OctahedronGeometry(0.5, 0);
      geometry.scale(1.1, 0.7, 0.9);
      break;
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`groundLitter: unknown shape set ${String(exhaustive)}`);
    }
  }
  paintTopUnder(geometry, underRatio);
  return geometry;
}

/** Radial fbm displacement, sampled by direction so shared vertices agree. */
function displace(geometry: BufferGeometry, seed: number, amount: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5;
    const scale = 1 + (fbm(u, v, { seed, period: 4, octaves: 3 }) - 0.5) * 2 * amount;
    position.setXYZ(i, x * scale, y * scale, z * scale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

/** Top-face value at the instance hue, underside toward the shade colour. */
function paintTopUnder(
  geometry: BufferGeometry,
  underRatio: readonly [number, number, number],
): void {
  const position = geometry.attributes.position as BufferAttribute;
  const normal = geometry.attributes.normal as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const up = normal.getY(i) * 0.5 + 0.5;
    const t = up * up * (3 - 2 * up);
    colors[i * 3] = underRatio[0] + (1 - underRatio[0]) * t;
    colors[i * 3 + 1] = underRatio[1] + (1 - underRatio[1]) * t;
    colors[i * 3 + 2] = underRatio[2] + (1 - underRatio[2]) * t;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

