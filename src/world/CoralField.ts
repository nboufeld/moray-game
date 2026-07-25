import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildColorTexture, buildNormalTexture, fbm, voronoi } from "../rendering/ProceduralTexture";
import { Random, SEEDS } from "../util/Random";
import { seabedHeight } from "./Seabed";

interface ClusterSite {
  readonly x: number;
  readonly z: number;
  /** Heads in this bommie. */
  readonly heads: number;
}

/**
 * Five bommies rather than an even sprinkling.
 *
 * Eight small clusters spread over a forty-metre square is statistically
 * uniform coverage, and uniform coverage is exactly what makes an image read
 * as procedural filler. Grouping is only half of composition; the other half
 * is the emptiness it creates, so these hug the pinnacle feet and the crevice
 * mounds and leave the sand between them bare — including the channels the
 * morays are approached along (x ≈ -6 south to the dragon, the z ≈ 6 band out
 * to the ribbon and zebra, and the spawn line down x ≈ 0), which have to stay
 * clear to look down as well as to swim.
 *
 * The first site is composition rather than habitat: it is the only colour in
 * the establishing shot's middle distance, half way between the dark
 * foreground shoulder and the crevice the shot is about.
 */
const SITES: readonly ClusterSite[] = [
  { x: -4.8, z: 11.8, heads: 12 },
  { x: 13.6, z: -2.5, heads: 12 },
  { x: 4.2, z: -1.2, heads: 11 },
  { x: -16.2, z: 9.6, heads: 10 },
  { x: -4.4, z: -18.2, heads: 12 },
];

/**
 * Reef-building coral in three silhouettes — branching, boulder and table.
 *
 * A garden of identical cones reads as traffic cones however it is coloured;
 * the variety of silhouette is what makes it read as coral, so shape carries
 * more weight here than the palette does.
 *
 * Every head is flattened into shared instanced meshes. Built as individual
 * meshes this field cost roughly two hundred draw calls, twice over once the
 * shadow pass ran, which dominated the frame on machines without hardware
 * acceleration. Instanced, the whole garden is ten.
 */

/**
 * Dusty, absorbed reef tones rather than swatch colours.
 *
 * Ten metres of water has already eaten most of the red out of the light
 * before it reaches these heads, so a fully saturated pink or purple down here
 * is not a bold choice, it is a physical impossibility — and it is the loudest
 * plastic-toy tell in the frame. These are the same hue families, taken down
 * in chroma to where the water leaves them: rust, dried rose, ochre, sea
 * green, dusty violet, clay. The wide value multiplier below matters as much
 * as the hues: a garden all at one value reads as one moulded object.
 */
const PALETTE = [0xc7755a, 0xb06379, 0xcca572, 0x69a99c, 0x8372a9, 0xac755e];

type ShapeKind = "branch" | "boulder" | "polyp" | "tableTop" | "tableStalk";

interface Part {
  readonly kind: ShapeKind;
  readonly matrix: Matrix4;
  readonly color: Color;
  readonly glowing: boolean;
}

export class CoralField {
  readonly group = new Group();
  /** Where each head meets the sand, for the seabed's baked contact shadows. */
  readonly contacts: { x: number; z: number; radius: number; strength: number }[] = [];

  constructor(seed: number) {
    const random = new Random(seed);
    /**
     * Tables draw their lean and tilt from their own stream.
     *
     * `random` also places every head, so a draw taken inside `addTable` would
     * shift each following head and re-roll the whole garden — and these
     * bommies are composed for the canonical cameras, not scattered. A second
     * stream keeps the layout bit-identical while the plates still vary.
     */
    const tableRandom = new Random(seed ^ 0x7ab1_e001);
    const parts: Part[] = [];

    for (const site of SITES) {
      for (let i = 0; i < site.heads; i++) {
        const x = site.x + random.signed(2.8);
        const z = site.z + random.signed(2.8);

        const color = new Color(
          PALETTE[Math.floor(random.next() * PALETTE.length)] ?? PALETTE[0]!,
        ).multiplyScalar(random.range(0.6, 1.15));
        // A minority of heads are bioluminescent. Kept rare on purpose:
        // everything glowing reads as neon, a few glowing reads as magic.
        const glowing = random.next() < 0.28;

        const head = new Object3D();
        head.position.set(x, seabedHeight(x, z), z);
        head.rotation.y = random.range(0, Math.PI * 2);
        const headScale = random.range(0.72, 1.35);
        head.scale.setScalar(headScale);
        head.updateMatrix();
        this.contacts.push({ x, z, radius: headScale * 1.9, strength: 0.42 });

        const roll = random.next();
        if (roll < 0.45) {
          addBranching(parts, head.matrix, color, glowing, random);
        } else if (roll < 0.78) {
          addBoulder(parts, head.matrix, color, glowing, random);
        } else {
          addTable(parts, head.matrix, color, glowing, tableRandom);
        }
      }
    }

    const geometries: Record<ShapeKind, BufferGeometry> = {
      branch: new ConeGeometry(0.17, 1.5, 6),
      boulder: boulderGeometry(),
      polyp: new SphereGeometry(0.1, 6, 5),
      tableTop: plateGeometry(),
      tableStalk: new CylinderGeometry(0.14, 0.2, 0.7, 6),
    };

    for (const kind of Object.keys(geometries) as ShapeKind[]) {
      for (const glowing of [false, true]) {
        const matching = parts.filter((part) => part.kind === kind && part.glowing === glowing);
        if (matching.length === 0) {
          continue;
        }
        this.group.add(buildInstances(geometries[kind], matching, glowing, kind));
      }
    }
  }
}

function buildInstances(
  geometry: BufferGeometry,
  parts: readonly Part[],
  glowing: boolean,
  kind: ShapeKind,
): InstancedMesh {
  const skin = coralSkin(kind);
  const material = new MeshStandardMaterial({
    // Coral is a porous limestone skeleton under a skin of polyps. At 0.72 it
    // held a broad specular sheen across every head at once, which is most of
    // what read as moulded plastic.
    roughness: 0.88,
    metalness: 0,
    flatShading: true,
    // The maps stay light and hue-neutral so the per-instance colour below
    // keeps carrying the variation across the garden; what they do carry is
    // baked occlusion, which is a multiplier on whatever hue lands on them.
    map: skin.map,
    normalMap: skin.normal,
    // Only the table plate ships one, to shade its underside. Vertex colour
    // and instance colour multiply together in the shader, so the per-head
    // tint survives it.
    vertexColors: geometry.hasAttribute("color"),
  });

  if (glowing) {
    // Emissive is a material uniform, so on its own every glowing head would
    // share one colour. Multiplying it by the per-instance colour lets each
    // head glow in its own hue while still sharing a single draw call.
    material.emissive = new Color(0xffffff);
    material.emissiveIntensity = 0.4;
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         totalEmissiveRadiance *= vColor;`,
      );
    };
  }

  const mesh = new InstancedMesh(geometry, material, parts.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  parts.forEach((part, index) => {
    mesh.setMatrixAt(index, part.matrix);
    mesh.setColorAt(index, part.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return mesh;
}

interface CoralSkin {
  readonly map: DataTexture;
  readonly normal: DataTexture;
}

const SKIN_SIZE = 256;
const skinCache = new Map<ShapeKind, CoralSkin>();

interface SkinRecipe {
  /** Surface height, differentiated into the normal map. */
  readonly height: (u: number, v: number) => number;
  /** Albedo multiplier, carrying the baked occlusion. */
  readonly tone: (u: number, v: number) => number;
  readonly strength: number;
}

/**
 * Surface detail per silhouette, shared across every instance of that shape.
 *
 * Height and tone are separate on purpose. A normal map only tilts the light;
 * it cannot darken anything, so a corallite wall lit from the side stayed as
 * bright as the dome beside it and the head kept reading as one smooth lump
 * with a pattern printed on it. The occlusion a real coral head owns —
 * daylight cannot reach the bottom of a corallite, whichever way the head
 * faces — has to be in the albedo, and it is the difference between a surface
 * with interior structure and a decal.
 *
 * Boulder heads get the most attention: a Voronoi corallite pattern — domed
 * cells separated by walls sunk deep in shadow — is the single detail that
 * makes a lump of geometry read unmistakably as brain coral.
 */
function coralSkin(kind: ShapeKind): CoralSkin {
  const cached = skinCache.get(kind);
  if (cached) {
    return cached;
  }

  const recipe = skinRecipe(kind);
  const skin: CoralSkin = {
    map: buildColorTexture(SKIN_SIZE, (u, v) => {
      const tone = recipe.tone(u, v);
      return [tone, tone * 0.99, tone * 0.96];
    }),
    normal: buildNormalTexture(SKIN_SIZE, recipe.height, recipe.strength),
  };

  skinCache.set(kind, skin);
  return skin;
}

function skinRecipe(kind: ShapeKind): SkinRecipe {
  const seed = SEEDS.coralSkin + kind.length * 7919;

  switch (kind) {
    case "boulder":
    case "polyp": {
      /**
       * Corallites at two scales. One Voronoi period gives every cell on the
       * head the same diameter, which no colony has: growth crowds at the
       * crown and spreads at the flanks. The coarser field, blended in at
       * roughly a third, breaks that regularity into lobes of larger and
       * smaller cells; both are resolved into the one map, so the second
       * scale costs nothing at draw time.
       *
       * Both return the distance to the cell wall, normalised so 0 is the
       * wall itself and 1 the middle of a cell dome.
       */
      const cell = (u: number, v: number): { dome: number; crown: number } => {
        const fine = voronoi(u, v, 12, seed);
        const coarse = voronoi(u, v, 4, seed ^ 0x1f83);
        // Raised to a fractional power so the wall is a line and not a
        // gradient: with a linear falloff the shaded band covered half the
        // surface and the head just went uniformly dark, which buys the
        // penalty of occlusion without the structure it is there to give.
        const fineWall = Math.min(1, (fine.f2 - fine.f1) / 0.03) ** 0.6;
        const coarseWall = Math.min(1, (coarse.f2 - coarse.f1) / 0.09) ** 0.6;
        return {
          dome: fineWall * 0.7 + coarseWall * 0.3,
          crown: 1 - Math.min(1, fine.f1 / 0.08),
        };
      };
      return {
        height: (u, v) => {
          const { dome, crown } = cell(u, v);
          return dome * 0.85 + crown * 0.1;
        },
        // Deep in the wall almost nothing gets out again; the dome tops keep
        // the full hue.
        tone: (u, v) => 0.35 + 0.65 * cell(u, v).dome,
        strength: 0.09,
      };
    }
    case "branch": {
      // Fine longitudinal ribbing plus polyp speckle.
      const height = (u: number, v: number): number =>
        Math.sin(u * Math.PI * 2 * 8) * 0.18 +
        0.5 +
        fbm(u, v, { seed, period: 24, octaves: 3 }) * 0.5;
      return {
        height,
        /**
         * Growth runs at the tips, where the skeleton is newest and thinnest
         * and the tissue barely covers it — every staghorn is pale at the
         * ends and dark down in the crotch of the branch, where the light
         * never gets. `v` runs 1 at the cone's point to 0 at its base.
         */
        tone: (u, v) => (0.6 + height(u, v) * 0.32) * (0.75 + v * 0.5),
        strength: 0.05,
      };
    }
    case "tableTop": {
      /**
       * The plate's faces are laid out as a disc: a cylinder cap's UVs run
       * out from (0.5, 0.5) to a circle of radius 0.5, and the rim band takes
       * the square around it. So growth structure has to be authored in polar
       * coordinates about that centre. Banding straight down `v` — the
       * obvious reading of "concentric" — comes out as parallel stripes
       * across the plate, which is corduroy, and corduroy is upholstery.
       *
       * What a plate coral actually shows is branchlets radiating from the
       * stalk, crossed by the growth rings the colony laid down as it spread.
       * Outside the inscribed circle nothing but the rim band samples, so
       * that region crossfades to plain noise — which keeps the whole tile
       * seamless where the band wraps.
       */
      const height = (u: number, v: number): number => {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const radius = Math.hypot(dx, dy) * 2;
        const angle = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;

        const rings = Math.sin(radius * Math.PI * 2 * 6) * 0.5 + 0.5;
        /**
         * Branchlets radiating from the stalk — but jittered in both spacing
         * and depth. Evenly spaced ribs of equal depth are a parasol, which
         * is the same failure as the table with a different outline; a colony
         * crowds its branchlets where it grew fastest. The jitter is itself
         * periodic in the angle, so the rim band still wraps.
         */
        const jitter = fbm(angle, 0.5, { seed: seed ^ 0x91c3, period: 5, octaves: 2 });
        const depth = 0.45 + fbm(angle, 0.5, { seed: seed ^ 0x33d7, period: 3, octaves: 2 }) * 0.8;
        // Ribs converge at the centre, so fade them out before they collapse
        // into a moiré knot there.
        const ribs =
          (Math.sin((angle * 22 + jitter * 1.7) * Math.PI * 2) * 0.5 + 0.5) *
          Math.min(1, radius / 0.3) *
          depth;
        const grain = fbm(u, v, { seed, period: 16, octaves: 3 });
        const plate = rings * 0.3 + ribs * 0.42 + grain * 0.28;

        const band = 0.35 + grain * 0.5;
        const feather = Math.min(1, Math.max(0, (radius - 0.84) / 0.16));
        return plate * (1 - feather) + band * feather;
      };
      return {
        height,
        /**
         * Occlusion sits in the ring valleys and between the ribs, and the
         * growing margin at the rim is darker than the crown. The underside
         * proper is shaded per vertex in `plateGeometry` — it faces away from
         * every light in the scene, which no map can express on its own.
         */
        tone: (u, v) => {
          const radius = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2);
          return (0.56 + height(u, v) * 0.58) * (1 - 0.26 * radius * radius);
        },
        strength: 0.05,
      };
    }
    case "tableStalk": {
      // A short trunk: longitudinal grooves where the plate's ribs run down
      // into it, roughened by the same grain.
      const height = (u: number, v: number): number =>
        (Math.sin(u * Math.PI * 2 * 9) * 0.5 + 0.5) * 0.45 +
        fbm(u, v, { seed, period: 12, octaves: 3 }) * 0.55;
      return {
        height,
        // The plate is the stalk's own ceiling, so the shade deepens upward.
        tone: (u, v) => (0.6 + height(u, v) * 0.4) * (0.95 - v * 0.22),
        strength: 0.06,
      };
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled coral shape: ${String(exhaustive)}`);
    }
  }
}

/**
 * The shared boulder template, knocked out of round.
 *
 * A subdivided icosahedron is a sphere with a rendering artefact, and a
 * garden of them reads as marbles however they are textured. This is the same
 * radial FBM displacement the rocks get, hand-rolled rather than borrowed
 * from `weatherRock`: that one finishes by box-projecting UVs and writing a
 * facing tint, and the corallite pattern here is authored against the
 * icosahedron's own spherical UVs — box projection at this scale would spread
 * about one cell across a whole head.
 *
 * Displacing the template once is also the only affordable place to do it.
 * Every boulder in the reef is an instance of this geometry, so the cost is
 * one pass over 240 vertices at construction, not one per head.
 */
function boulderGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(0.62, 1);
  const position = geometry.attributes.position;
  if (!position) {
    return geometry;
  }

  const seed = SEEDS.coralSkin ^ 0x0b0d_5e11;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;

    // Sampled by direction, so vertices shared between faces displace
    // identically and the surface stays closed.
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5;
    const scale = 1 + (fbm(u, v, { seed, period: 6, octaves: 4 }) - 0.5) * 0.24;
    position.setXYZ(i, x * scale, y * scale, z * scale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Nominal plate radius, before the rim noise pushes it around. */
const PLATE_RADIUS = 1.1;

/**
 * The shared table plate: a lobed, warped, flaring disc rather than a table
 * top.
 *
 * A true circle of constant thickness, level, on a centred stalk, is patio
 * furniture, and no amount of surface texture argues with a silhouette. Three
 * things are wrong with the primitive and all three are fixed here: the rim
 * is pushed in and out by noise, the plate is warped out of plane so its edge
 * rises and falls and its middle domes, and it flares outward as it rises the
 * way a plate coral grows into the light rather than tapering like a table's
 * moulded lip.
 *
 * Everything is sampled by direction and radius, never per vertex, so
 * neighbouring rings move as one and the shell stays closed.
 */
function plateGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(PLATE_RADIUS, 0.9, 0.1, 15);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  if (!position || !normal) {
    return geometry;
  }

  // Read the cap facing before displacement, while the cylinder's own normals
  // still say cleanly which vertices face down.
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    // Daylight arrives from above and the plate is its own ceiling: the
    // underside only ever sees bounce, so bake that in rather than hope the
    // lighting finds it.
    const shade = 1 - 0.45 * Math.max(0, -normal.getY(i));
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const seed = SEEDS.coralSkin ^ 0x71ab_1e00;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const radial = Math.min(1, Math.hypot(x, z) / PLATE_RADIUS);

    /**
     * Two scales of rim noise. The broad one — three lobes around the whole
     * colony — is what stops the plate being a disc at all: the margin runs
     * from about 0.6 to 1.3 of the nominal radius, so the plate reaches twice
     * as far into the light on one side as it does on the other. The tight
     * one scallops the edge between neighbouring segments.
     */
    const lobe =
      1 +
      (fbm(angle, 0.5, { seed: seed ^ 0x5a35, period: 3, octaves: 2 }) - 0.5) * 1.2 +
      (fbm(angle, 0.5, { seed: seed ^ 0xf1b9, period: 9, octaves: 1 }) - 0.5) * 0.7;
    // The rim lifts and drops around the colony, and the crown sits proud of
    // it — a plate that has grown, rather than one that was turned.
    const warp = (fbm(angle, 0.5, { seed: seed ^ 0x2c5f, period: 5, octaves: 2 }) - 0.5) * 0.7;
    const crown = 0.07 * (1 - radial * radial);

    position.setXYZ(i, x * lobe, position.getY(i) + warp * radial + crown, z * lobe);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Composes a part's local transform into its head's world matrix. */
function push(
  parts: Part[],
  kind: ShapeKind,
  headMatrix: Matrix4,
  local: Object3D,
  color: Color,
  glowing: boolean,
): void {
  local.updateMatrix();
  parts.push({
    kind,
    matrix: new Matrix4().multiplyMatrices(headMatrix, local.matrix),
    color,
    glowing,
  });
}

/** A spray of tapered fingers, the classic staghorn silhouette. */
function addBranching(
  parts: Part[],
  headMatrix: Matrix4,
  color: Color,
  glowing: boolean,
  random: Random,
): void {
  const local = new Object3D();
  const fingers = Math.round(random.range(4, 8));
  for (let i = 0; i < fingers; i++) {
    const lean = random.range(0.1, 0.42);
    const around = (i / fingers) * Math.PI * 2 + random.signed(0.4);
    const height = random.range(0.6, 1.15);
    local.scale.set(random.range(0.7, 1.1), height, random.range(0.7, 1.1));
    local.position.set(Math.cos(around) * 0.28, height * 0.72, Math.sin(around) * 0.28);
    local.rotation.set(Math.sin(around) * lean, 0, -Math.cos(around) * lean);
    push(parts, "branch", headMatrix, local, color, glowing);
  }
}

/** A squat dome, crusted with polyps. */
function addBoulder(
  parts: Part[],
  headMatrix: Matrix4,
  color: Color,
  glowing: boolean,
  random: Random,
): void {
  const local = new Object3D();
  local.scale.set(random.range(0.9, 1.4), random.range(0.55, 0.85), random.range(0.9, 1.4));
  local.position.set(0, 0.28, 0);
  local.rotation.set(0, 0, 0);
  push(parts, "boulder", headMatrix, local, color, glowing);

  const polyps = Math.round(random.range(4, 9));
  for (let i = 0; i < polyps; i++) {
    const around = random.range(0, Math.PI * 2);
    const radius = random.range(0.1, 0.5);
    local.scale.setScalar(1);
    local.position.set(Math.cos(around) * radius, random.range(0.45, 0.68), Math.sin(around) * radius);
    push(parts, "polyp", headMatrix, local, color, glowing);
  }
}

/**
 * A plate on a stalk, the shape that casts the best shade to hide under.
 *
 * The plate's outline is already irregular in `plateGeometry`, but every head
 * shares that one geometry, so the rest of the variety has to come from the
 * transform: the stalk stands off-centre, the plate sits over at a tilt and
 * is squashed on one axis. A colony grows toward the light it can reach, not
 * symmetrically about its own foot.
 */
function addTable(
  parts: Part[],
  headMatrix: Matrix4,
  color: Color,
  glowing: boolean,
  random: Random,
): void {
  const local = new Object3D();

  const leanAround = random.range(0, Math.PI * 2);
  const lean = random.range(0.09, 0.2);
  local.scale.setScalar(1);
  local.rotation.set(0, 0, 0);
  local.position.set(Math.cos(leanAround) * lean, 0.35, Math.sin(leanAround) * lean);
  push(parts, "tableStalk", headMatrix, local, color, glowing);

  const tiltAround = random.range(0, Math.PI * 2);
  const tilt = random.range(0.05, 0.11);
  local.scale.set(random.range(0.86, 1.12), 1, random.range(0.86, 1.12));
  local.rotation.set(
    Math.sin(tiltAround) * tilt,
    random.range(0, Math.PI * 2),
    Math.cos(tiltAround) * tilt,
  );
  local.position.set(0, 0.7, 0);
  push(parts, "tableTop", headMatrix, local, color, glowing);
}
