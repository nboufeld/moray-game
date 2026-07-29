import {
  BufferAttribute,
  CapsuleGeometry,
  CylinderGeometry,
  DataTexture,
  IcosahedronGeometry,
  LatheGeometry,
  LinearMipmapLinearFilter,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { readImage, textureFromPixels } from "../rendering/ImagePixels";
import { buildColorTexture, buildNormalTexture, fbm, voronoi } from "../rendering/ProceduralTexture";
import { smoothNormals } from "../rendering/SmoothNormals";
import { Random, SEEDS } from "../util/Random";

/**
 * Every silhouette the coral garden is built out of, and the surfaces they
 * wear.
 *
 * It is split out of `CoralField` because the two answer different questions.
 * This file is *what a coral is*: eight shapes, their skins, and the one
 * painted asset among them. `CoralField` is *where they stand* — the clusters,
 * the colour families, the clearances the discovery corridors need. The split
 * fell out of the garden growing from three silhouettes to eight; one file
 * carrying both was most of a thousand lines and the layout was buried in the
 * middle of it.
 *
 * ## The size hierarchy is the point
 *
 * Three shapes at one size is a scatter of shrubs however many of them there
 * are, and a reef photographed from a boat reads as a garden because a handful
 * of colonies are *landmarks* and everything else is the ground they stand in.
 * So the eight split three ways:
 *
 * - **Landmarks** — `staghorn` and `brain`, built in Blender
 *   (`tools/blender/build_*.py`), 1.0–1.6 m and 0.6–1.2 m across. These are the
 *   pieces that have to read from fifteen metres, which is why they are
 *   modelled rather than assembled from primitives: a staghorn's silhouette is
 *   a branching one and a brain coral's is a furrowed dome, and neither
 *   survives being approximated by a capsule at that distance.
 * - **Mid** — `plateStack`, `tube` and `fan`, 0.5–1.4 m. Built here, from
 *   lathes, merged discs and one painted quad.
 * - **Fill** — `branch`, `boulder` and `polyp`, the old garden's shapes, kept
 *   at the small end where they do what they always did.
 *
 * ## The unit footprint
 *
 * Everything except the three fill shapes is authored **one metre tall, foot on
 * y = 0, centred on the y axis**, and its real size is the instance matrix's.
 *
 * That is a contract rather than a convention, and the reason is the swap: a
 * Blender piece arrives after the field is already standing, and `CoralField`
 * hangs it on an `InstancedMesh` whose matrices were written against the
 * procedural stand-in. If the two disagree about what one unit means, the whole
 * garden jumps when the model lands — on a fast connection, between two frames
 * nobody is looking at; on a slow one, in the middle of a capture. The fill
 * shapes are exempt because their `add*` builders in `CoralField` compose local
 * transforms around the frames those primitives are born in, and nothing about
 * them ever comes off disk.
 */

export type CoralKind =
  | "staghorn"
  | "brain"
  | "plateStack"
  | "tube"
  | "fan"
  | "branch"
  | "boulder"
  | "polyp";

/**
 * Which kinds come off disk, and from where.
 *
 * A kind that is not here is procedural everywhere. A kind that is here is
 * procedural until the file lands and procedural forever if it does not — see
 * `requestModel`. Both builds are shipping configurations, so the fallbacks
 * below are held to the same size and silhouette as the models they stand in
 * for, not sketched.
 */
export const CORAL_MODELS: Partial<Record<CoralKind, string>> = {
  staghorn: "models/coral-staghorn.glb",
  brain: "models/coral-brain.glb",
};

/** The painted sea fan, the first authored image in the garden. */
export const FAN_ASSET = "world/coral-fan.png";

/**
 * The painted skin washes (W-O3), completing the spec W-N5 wrote: one 512²
 * sRGB colour strip per species that stayed flat close up after its
 * procedural retune. The brain's is a meandering valley-shadow-and-ridge-light
 * wash sampled by the GLB's spherical `project_uvs` (8×4 tiles around the
 * dome, so both wraps must repeat — the join measured under one part of step
 * above the image's own interior noise, which is the plain-repeat test the
 * sand wash set); the plate's is concentric growth rings and radial
 * branchlets about (0.5, 0.5), the cylinder cap's own polar layout, palest at
 * the margin so the vertex paint's growth gradient and the map agree about
 * which way the colony grew.
 *
 * A kind that is not here keeps its generated skin everywhere; a kind that is
 * here keeps it in the no-assets build and until the file lands — the same
 * contract as `CORAL_MODELS` one asset class over.
 */
export const CORAL_WASHES: Partial<Record<CoralKind, string>> = {
  brain: "world/coral-brain-wash.png",
  plateStack: "world/coral-plate-wash.png",
};

/**
 * How tall a fan's quad is in its own space, for the sway injection.
 *
 * Shared with `CoralField` rather than repeated there: the vertex shader bends
 * the blade by its height above the root, and a mismatch between the number in
 * the shader and the geometry's actual extent is a hinge in the wrong place.
 */
export const FAN_HEIGHT = 1;

const cache = new Map<CoralKind, BufferGeometry>();

/**
 * The shared geometry for a silhouette, built once for the whole process.
 *
 * Owned here and never disposed by a caller, exactly as `AssetLibrary`'s
 * textures are: the reef's garden and the sanctuary's are two `CoralField`s
 * over one set of shapes, and either one releasing them would empty the other.
 */
export function coralGeometry(kind: CoralKind): BufferGeometry {
  const existing = cache.get(kind);
  if (existing) {
    return existing;
  }
  const geometry = buildGeometry(kind);
  cache.set(kind, geometry);
  return geometry;
}

function buildGeometry(kind: CoralKind): BufferGeometry {
  switch (kind) {
    case "staghorn":
      return staghornGeometry();
    case "brain":
      return brainGeometry();
    case "plateStack":
      return plateStackGeometry();
    case "tube":
      return tubeGeometry();
    case "fan":
      return fanGeometry();
    /**
     * A finger, not a spike. The cone this replaced came to a point, and a
     * spray of points is a sea urchin or a set of traffic cones depending on
     * how it is coloured — either way it is the one silhouette in the garden
     * that reads as a hazard rather than as a plant. A capsule is the same
     * staghorn gesture with the ends rounded off, which is what the living
     * tissue on a branch tip actually looks like.
     */
    case "branch":
      return new CapsuleGeometry(0.16, 1.1, 2, 6);
    case "boulder":
      return boulderGeometry();
    // Five by three, not six by five. A polyp is eleven centimetres across and
    // there are still over a hundred of them; at the distance any camera in
    // this game stands, the two spheres cannot be told apart, which is the same
    // measurement the fish's body was cut down on in WP-G8.
    case "polyp":
      return new SphereGeometry(0.1, 5, 3);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled coral shape: ${String(exhaustive)}`);
    }
  }
}

/** Seeds for the shapes, forked off the garden's own stream. */
const SHAPE_SEED = SEEDS.coralSkin ^ 0x5_ba7e;

const UP = new Vector3(0, 1, 0);

/**
 * The staghorn's trunk girth and how much of it a branch keeps, matched to
 * `TRUNK_RADIUS` and `TAPER` in `tools/blender/build_staghorn.py`.
 *
 * Both were thinner, and both were wrong for the same reason: this reef is
 * painted in three-metre boulders and eight-metre arches, and a coral drawn at
 * a real staghorn's five-centimetre girth beside them is a wire model. At the
 * distance the canonical cameras stand it was literally sub-pixel.
 */
const STAGHORN_RADIUS = 0.125;
const STAGHORN_TAPER = 0.74;

/* ------------------------------------------------------------------ *
 *  Landmarks
 * ------------------------------------------------------------------ */

/**
 * The staghorn thicket, as a stand-in for `coral-staghorn.glb`.
 *
 * Same recursion as the build script, same three trunks at two depths, same
 * unit footprint — capsules welded into one buffer instead of a skinned curve
 * tree. It is coarser than the model and it is not meant to be anything else:
 * what it has to be is the same *piece*, at the same size, so that the
 * assetless build is a coherent reef rather than a reef with holes in it, and
 * so that a shot taken before the GLB lands is a shot of the same composition.
 */
function staghornGeometry(): BufferGeometry {
  const random = new Random(SHAPE_SEED ^ 0x0001);
  const parts: BufferGeometry[] = [];

  const grow = (base: Vector3, direction: Vector3, length: number, radius: number, depth: number): void => {
    const tip = base.clone().addScaledVector(direction, length);
    const segment = new CapsuleGeometry(radius, length, 1, 5);
    segment.applyMatrix4(
      new Matrix4().compose(
        base.clone().add(tip).multiplyScalar(0.5),
        new Quaternion().setFromUnitVectors(UP, direction),
        new Vector3(1, 1, 1),
      ),
    );
    parts.push(segment);
    if (depth === 0) {
      return;
    }

    const kids = random.next() < 0.72 ? 2 : 3;
    for (let i = 0; i < kids; i++) {
      const yaw = random.range(0, Math.PI * 2);
      const tilt = random.range(0.62, 1.15);
      const child = new Vector3(
        direction.x + Math.cos(yaw) * tilt,
        direction.y + random.range(0.22, 0.72),
        direction.z + Math.sin(yaw) * tilt,
      ).normalize();
      grow(tip, child, length * random.range(0.62, 0.8), radius * STAGHORN_TAPER, depth - 1);
    }
  };

  const depths = [3, 2, 2];
  depths.forEach((depth, trunk) => {
    const around = (trunk / depths.length) * Math.PI * 2 + random.signed(0.3);
    const lean = random.range(0.22, 0.48);
    grow(
      new Vector3(Math.cos(around) * 0.1, 0, Math.sin(around) * 0.1),
      new Vector3(Math.cos(around) * lean, 1, Math.sin(around) * lean).normalize(),
      (depth === 3 ? 0.5 : 0.36) * random.range(0.9, 1.12),
      STAGHORN_RADIUS,
      depth,
    );
  });

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    // `mergeGeometries` returns null only if the inputs disagree about their
    // attributes, which capsules of one construction cannot — but a silent
    // `?? body` fallback is exactly how the fish lost their tails for a week.
    throw new Error("staghorn: capsule merge failed");
  }

  unitFootprint(merged);
  paintByHeight(merged, (height) => {
    const value = Math.pow(0.8 + height * height * 0.2, 2.2);
    return [value, value * 0.97, value * 0.9];
  });
  merged.computeVertexNormals();
  return merged;
}

/**
 * Ridges around the brain coral's dome pole to pole, and how far the field is
 * dragged before it is read.
 *
 * Zero warp is corduroy; too many ridges with too much warp is the opposite
 * failure and the one these were retuned out of — the ridges close on
 * themselves into separate cells, and a dome covered in cells is a pinecone.
 * A maze coral's ridge runs a long way before it turns. Matched to
 * `FURROW_PERIOD` and `WARP` in `tools/blender/build_brain.py`.
 */
const FURROW_CYCLES = 2.7;
const FURROW_WARP = 1.5;
/** How deep a furrow is cut, in radii. */
const FURROW_DEPTH = 0.085;
/** Where the dome is cut off below its equator, in radii. */
const BRAIN_FOOT = -0.34;
/** How far the dome is squashed. Under about 0.7 it reads as a pancake. */
const BRAIN_SQUASH = 0.78;

/**
 * The brain coral, as a stand-in for `coral-brain.glb` — and the same
 * algorithm, which is the point of it.
 *
 * The furrows are geometry in both builds, because that is the whole reason
 * this piece exists next to `boulder`: the boulder already wears a Voronoi
 * corallite *map*, and a map cannot break a silhouette. A mapped dome at
 * fifteen metres, with the normal map long since mipped away, is a lump. A
 * furrowed one still has a face.
 *
 * They meander because the ridge field is read at a *warped* coordinate. A
 * sine of the raw polar angle is corduroy, which is upholstery — the same trap
 * `skinRecipe`'s plate ribs are jittered out of, one scale up and in the
 * vertices rather than the texels.
 */
function brainGeometry(): BufferGeometry {
  // Detail 5, which is 720 triangles rather than the 1024 the name suggests:
  // `PolyhedronGeometry` splits each face into `(detail + 1)²`, not `4^detail`,
  // so the 3 this was written with gave 320 — four vertices across a furrow,
  // and a meander that came out as a zigzag. The model it stands in for solves
  // the same problem at a higher subdivision and then decimates back; there is
  // no decimator here, so the resolution is picked once and it lands between
  // the two: enough to carry a ridge, cheap enough for seven instances.
  //
  // Non-indexed, so a vertex shared between faces exists once per face — which
  // is exactly why the displacement below is sampled by *direction* rather than
  // per vertex: the copies then move identically and the shell stays closed.
  const geometry = new IcosahedronGeometry(1, 5);
  const position = geometry.attributes.position;
  if (!position) {
    return geometry;
  }

  const seed = SHAPE_SEED ^ 0x0002;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;

    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5;
    const warp = (fbm(u, v, { seed, period: 4, octaves: 2 }) - 0.5) * 2;
    const ridge = 0.5 + 0.5 * Math.sin((v * FURROW_CYCLES + warp * FURROW_WARP + u * 2.1) * Math.PI * 2);
    // Squared, so a trough is a groove with a floor rather than a sine's
    // symmetric valley — a maze coral is mostly ridge with cuts in it.
    const cut = (1 - ridge) ** 2;
    // A groove running down into the sand reads as damage, so they fade out
    // before the foot.
    const fade = smoothStep(BRAIN_FOOT, BRAIN_FOOT + 0.45, y / length);
    const scale = 1 - FURROW_DEPTH * cut * fade;

    position.setXYZ(
      i,
      (x / length) * scale,
      // Everything under the cut is folded onto it: the foot is buried in the
      // sand, and a flat disc there costs nothing a camera can reach.
      Math.max(BRAIN_FOOT, (y / length) * scale) * BRAIN_SQUASH,
      (z / length) * scale,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  // The line above writes a face normal to every vertex of a non-indexed
  // polyhedron, which is a cut gem however it is textured; welding them is what
  // makes it a dome with furrows in it.
  smoothNormals(geometry);
  unitFootprint(geometry);

  paintByHeight(geometry, (height, x, z) => {
    // Re-read the field where the vertex ended up rather than caching it from
    // the loop above: the two stay independent, so the furrows can be retuned
    // without the shading quietly describing the previous build.
    const radius = Math.hypot(x, z);
    const length = Math.hypot(x, (height - 0.5) / BRAIN_SQUASH, z) || 1;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, (height - 0.5) / BRAIN_SQUASH / length))) / Math.PI + 0.5;
    const warp = (fbm(u, v, { seed, period: 4, octaves: 2 }) - 0.5) * 2;
    const ridge = 0.5 + 0.5 * Math.sin((v * FURROW_CYCLES + warp * FURROW_WARP + u * 2.1) * Math.PI * 2);
    const value = Math.pow(0.68 + ridge * 0.28 + clamp01(1 - radius * 1.4) * 0.04, 2.2);
    return [value, value * 0.96, value * 0.88];
  });
  return geometry;
}

/* ------------------------------------------------------------------ *
 *  Mid pieces
 * ------------------------------------------------------------------ */

/** How far a plate's underside is baked down; see `PLATE_UNDERSIDE` history. */
const PLATE_UNDERSIDE = 0.28;

/**
 * A stack of offset, wavy-rimmed plates on a common stalk.
 *
 * This is the old table coral's successor, and the stack is the correction. A
 * single plate on a single stalk is patio furniture at best and — seen edge-on
 * from below, lit along its rim, with its underside baked down — a plank at
 * worst; the review called the old one the strake of a wrecked hull. Three
 * discs at three heights, each pushed off the axis in a different direction,
 * cannot read as one flat thing from any angle: whatever the camera does, one
 * plate is foreshortened while another is not, and the piece has depth.
 *
 * The rims are pushed around by two scales of noise for the same reason they
 * were on the single plate, and capped for the same one: where the two scales
 * agree the margin throws a tongue out past a third of its radius, which on a
 * squat shape a metre off the sand is a length of driftwood.
 */
function plateStackGeometry(): BufferGeometry {
  const random = new Random(SHAPE_SEED ^ 0x0003);
  const parts: BufferGeometry[] = [];

  const stalk = new CylinderGeometry(0.1, 0.16, 0.86, 8);
  stalk.translate(0, 0.43, 0);
  // Painted before the merge, not after: `mergeGeometries` rejects any input
  // whose attributes disagree with the first one's, and the discs below arrive
  // carrying their baked undersides. This is also where the stalk gets its own
  // shade — the plates are its ceiling, so it deepens upward.
  paintByHeight(stalk, (height) => {
    const value = Math.pow(0.94 - height * 0.16, 2.2);
    return [value, value * 0.98, value * 0.95];
  });
  parts.push(stalk);

  // Widest at the bottom and stepping in as it climbs, which is the shape of a
  // colony that spread before it stacked. The reach is what the piece is for:
  // at the 0.6 or so this is instanced at, the lowest plate spans about 1.3 m,
  // and a plate coral narrower than a diver's shoulders is a mushroom.
  const discs = [
    { radius: 0.92, height: 0.28, offset: 0.18 },
    { radius: 0.7, height: 0.55, offset: 0.28 },
    { radius: 0.48, height: 0.8, offset: 0.22 },
  ];
  for (const [index, disc] of discs.entries()) {
    const plate = wavyDisc(disc.radius, SHAPE_SEED ^ (0x0031 + index * 0x77));
    const around = random.range(0, Math.PI * 2);
    // Tipped away from the axis it is pushed along, so a plate leans out over
    // its own overhang the way a colony grows toward the light it can reach.
    const tilt = random.range(0.05, 0.13);
    plate.applyMatrix4(
      new Matrix4().compose(
        new Vector3(Math.cos(around) * disc.offset, disc.height, Math.sin(around) * disc.offset),
        new Quaternion().setFromAxisAngle(
          new Vector3(-Math.sin(around), 0, Math.cos(around)),
          tilt,
        ),
        new Vector3(1, 1, 1),
      ),
    );
    parts.push(plate);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("plateStack: disc merge failed");
  }
  unitFootprint(merged);
  return merged;
}

/**
 * One plate of a stack: a lobed, warped, flaring disc rather than a table top.
 *
 * Everything is sampled by direction and radius, never per vertex, so
 * neighbouring rings move as one and the shell stays closed.
 */
function wavyDisc(radius: number, seed: number): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius * 0.86, 0.06, 16);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  if (!position || !normal) {
    return geometry;
  }

  // Read the cap facing before displacement, while the cylinder's own normals
  // still say cleanly which vertices face down. Daylight arrives from above and
  // a plate is its own ceiling, so its underside only ever sees bounce.
  //
  // Half what it once was, and for the reason that keeps coming back in this
  // project: under a ramp this is *modelling the light a second time*. The
  // underside already has the shade band; 0.55 on top of it took the plate to
  // about a fifth of its colour.
  //
  // The top face carries a growth gradient since W-N5 — the round critic
  // called the plates the flattest reads in the garden close up, and a flat
  // disc in one toon band is exactly one value however its map ripples. A
  // plate coral lays its newest, palest tissue at the margin and its mature
  // centre sits a step deeper and warmer, so the centre is taken down 16%
  // and warm-shifted while the rim stays at full — the same tip-gradient the
  // branches and the staghorn already wear, radially. It is a *marking*, not
  // a second model of the light: the gradient runs with growth, not with sun.
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const under = Math.max(0, -normal.getY(i));
    const radial = Math.min(1, Math.hypot(position.getX(i), position.getZ(i)) / radius);
    const centreDepth = (1 - under) * (1 - radial * radial);
    const shade = (1 - PLATE_UNDERSIDE * under) * (1 - 0.16 * centreDepth);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * (1 - 0.05 * centreDepth);
    colors[i * 3 + 2] = shade * (1 - 0.1 * centreDepth);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const radial = Math.min(1, Math.hypot(x, z) / radius);

    const lobe = Math.min(
      1.15,
      1 +
        (fbm(angle, 0.5, { seed: seed ^ 0x5a35, period: 3, octaves: 2 }) - 0.5) * 1.2 +
        (fbm(angle, 0.5, { seed: seed ^ 0xf1b9, period: 9, octaves: 1 }) - 0.5) * 0.7,
    );
    const warp = (fbm(angle, 0.5, { seed: seed ^ 0x2c5f, period: 5, octaves: 2 }) - 0.5) * 0.5 * radius;
    const crown = 0.07 * radius * (1 - radial * radial);

    position.setXYZ(i, x * lobe, position.getY(i) + warp * radial + crown, z * lobe);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A tube sponge: a tall, nearly straight-walled tube with a hollow mouth.
 *
 * A lathe rather than a cylinder because the mouth is the whole read. A sponge
 * seen from anywhere above its own rim shows a dark opening, and a capped
 * cylinder shows a lid — so the profile climbs the outside, turns over the rim
 * and runs back down the inside far enough that the shade band inside it is
 * visible before the floor closes it off.
 *
 * The proportions and the paint were both redone in W-N5, off the round
 * critic's words: the old profile flared from 0.11 at the foot to 0.31 at the
 * lip — bought in W-L2 to separate the silhouette from the branching fingers —
 * and that flare, under a vertex ramp that went to full cream exactly at the
 * rim, over a 14-stave groove map, was a wooden barrel with a pale hoop.
 * Cooperage, the same failure class as the old plate coral's "wrecked hull".
 * A living tube sponge is the other way around: long and narrow (about three
 * heights to a mouth-width here), its walls close to parallel with only a
 * soft trumpet at the lip, its rim *calmer* than its body, and its throat the
 * warmest colour on it. The silhouette separation the flare used to buy is
 * carried by the cluster instead — `CoralField.addMid` already plants three
 * to five of these per holdfast at staggered heights, and narrower tubes make
 * that read as a cluster of tubes rather than one lumpy urn.
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
  // Nine segments around. Twelve looked no different on a tube this size and
  // there are seventy of them; the mouth's ellipse is the only place the count
  // is legible at all, and nine still reads as round once it is smooth-shaded.
  const geometry = new LatheGeometry(profile, 9);
  paintTube(geometry, profile.length, lipIndex);
  unitFootprint(geometry);
  return geometry;
}

/**
 * The sponge's vertex paint, keyed off the lathe's own profile index — a
 * lathe writes `uv.y = j / (points - 1)`, so inside and outside are exact,
 * not guessed from normals.
 *
 * Two decisions, both answers to the barrel read:
 *
 * **No cream rim.** The exterior ramps from a shaded foot to a *calm* top —
 * its ceiling is well under the old 1.0, so the lip is never the brightest
 * ring in the frame. A pale hoop on a dark vessel is a barrel's defining
 * mark, and it was painted on at exactly the rim.
 *
 * **A warm throat.** The interior leans hard into red and deepens as it goes
 * down, so the mouth reads as living tissue over a dim interior — the warmth
 * multiplies the instance hue, so a rose sponge glows rose-warm and a violet
 * one plum, and nothing here can exceed the models' 1.0 vertex-colour
 * ceiling.
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

/**
 * How far the fan cups out of its own plane, at the rim.
 *
 * A gorgonian grows across the current as a flat mesh, and flat is exactly
 * what a quad already is — so left alone this piece is a card, and a card seen
 * edge-on is a line. The cup is what keeps a fan reading as a fan from an
 * oblique angle, and it is also what makes the toon ramp do something with it:
 * a curved surface crosses a band boundary, a flat one is one value all over.
 */
const FAN_CUP = 0.17;

/** The fan's quad: cupped, root-hinged, tessellated only enough to bend. */
function fanGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(1, FAN_HEIGHT, 4, 5);
  const position = geometry.attributes.position;
  if (!position) {
    return geometry;
  }

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i) + FAN_HEIGHT / 2;
    // Cupped across, and tipped back a little as it rises — a fan standing
    // dead upright is a signpost.
    position.setXYZ(i, x, y, -(x * x) * FAN_CUP * 4 - (y / FAN_HEIGHT) ** 2 * 0.06);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------------------ *
 *  Fill
 * ------------------------------------------------------------------ */

/**
 * The shared boulder template, knocked out of round.
 *
 * A subdivided icosahedron is a sphere with a rendering artefact, and a garden
 * of them reads as marbles however they are textured. This is the same radial
 * FBM displacement the rocks get, hand-rolled rather than borrowed from
 * `weatherRock`: that one finishes by box-projecting UVs and writing a facing
 * tint, and the corallite pattern here is authored against the icosahedron's
 * own spherical UVs — box projection at this scale would spread about one cell
 * across a whole head.
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
  smoothNormals(geometry);
  return geometry;
}

/* ------------------------------------------------------------------ *
 *  Shared geometry helpers
 * ------------------------------------------------------------------ */

/** Scales and shifts a piece into the unit footprint; see the module header. */
function unitFootprint(geometry: BufferGeometry, height = 1): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    return;
  }
  const scale = height / Math.max(1e-6, box.max.y - box.min.y);
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingSphere();
}

/**
 * Writes a vertex-colour multiplier from a piece's own height.
 *
 * It is a multiplier and never a colour: the species' hue is the instance
 * colour this is multiplied by, and the garden's whole variety lives in that
 * spread. A stand-in that brought its own terracotta would take the field to
 * mud — which is the correction `levelToBlade` makes for the painted grass, and
 * the one the Blender pieces make in `coral_common.py`.
 *
 * It only ever darkens, for a reason that is arithmetic rather than taste: the
 * models carry theirs in a normalised integer accessor, so anything over 1.0 is
 * clipped on the way out of Blender. The two paths keep the same ceiling so
 * that a piece does not change value when its model lands.
 */
function paintByHeight(
  geometry: BufferGeometry,
  sample: (height: number, x: number, z: number) => readonly [number, number, number],
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const low = box?.min.y ?? 0;
  const span = Math.max(1e-6, (box?.max.y ?? 1) - low);

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const [r, g, b] = sample((position.getY(i) - low) / span, position.getX(i), position.getZ(i));
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/* ------------------------------------------------------------------ *
 *  Surfaces
 * ------------------------------------------------------------------ */

export interface CoralSkin {
  readonly map: DataTexture;
  readonly normal: DataTexture | null;
}

const SKIN_SIZE = 256;
const skinCache = new Map<CoralKind, CoralSkin>();

interface SkinRecipe {
  /** Surface height, differentiated into the normal map. */
  readonly height: (u: number, v: number) => number;
  /** Albedo multiplier, carrying the baked occlusion. */
  readonly tone: (u: number, v: number) => number;
  /**
   * Per-channel drift on the tone, for a skin whose *hue* has to vary as
   * well as its value (the brain's mottle). Defaults to the near-neutral
   * warm every map here always wore; kept a hair's width from neutral so
   * the instance colour still owns the species' hue.
   */
  readonly tint?: (u: number, v: number) => readonly [number, number, number];
  readonly strength: number;
}

const NEUTRAL_TINT: readonly [number, number, number] = [1, 0.99, 0.96];

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
 * The two landmark pieces are the exception, and it is the whole reason they
 * are modelled: their structure is in their *vertices*, and their vertex
 * colours already carry the occlusion that structure earns. What is left for a
 * map there is grain — so their tone range is a third of a fill head's, and
 * anything more would be the double-modelling this project keeps having to
 * undo. See `CoralField`'s note on the two multiplying together.
 */
export function coralSkin(kind: CoralKind): CoralSkin {
  const cached = skinCache.get(kind);
  if (cached) {
    return cached;
  }

  const recipe = skinRecipe(kind);
  const skin: CoralSkin = {
    map: buildColorTexture(SKIN_SIZE, (u, v) => {
      const tone = recipe.tone(u, v);
      const [r, g, b] = recipe.tint?.(u, v) ?? NEUTRAL_TINT;
      return [tone * r, tone * g, tone * b];
    }),
    normal: buildNormalTexture(SKIN_SIZE, recipe.height, recipe.strength),
  };

  skinCache.set(kind, skin);
  return skin;
}

function skinRecipe(kind: CoralKind): SkinRecipe {
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
         * never gets.
         */
        tone: (u, v) => (0.6 + height(u, v) * 0.32) * (0.75 + v * 0.5),
        strength: 0.05,
      };
    }
    case "staghorn": {
      /**
       * Grain, and only grain. The landmarks carry their structure in their
       * geometry and their occlusion in their vertex colours, and the two
       * multiply — so a map with a fill head's tone range on top of it takes a
       * furrow to a tenth of the colony's colour. Sub-centimetre noise at a
       * shallow range is what a map is still worth here: it stops a
       * metre-and-a-half of smooth surface reading as moulded plastic when the
       * camera comes within touching distance of it, which is exactly where
       * `probe-moray.mjs` and shot G put it.
       *
       * The UVs are written by `project_uvs` in the build script and matched by
       * the stand-in's own primitives, both at roughly one tile per fifteen
       * centimetres of surface.
       */
      const height = (u: number, v: number): number =>
        fbm(u, v, { seed, period: 16, octaves: 3 }) * 0.7 +
        fbm(u, v, { seed: seed ^ 0x2f11, period: 48, octaves: 2 }) * 0.3;
      return {
        height,
        tone: (u, v) => 0.84 + height(u, v) * 0.18,
        strength: 0.05,
      };
    }
    case "brain": {
      /**
       * The staghorn's grain, plus a broad mottle (W-N5). The double-modelling
       * fence still holds — the furrows' occlusion is baked into the GLB's
       * vertex colours and nothing here re-shades them — but grain alone left
       * a metre-wide dome reading as one flat pour of colour at conversational
       * distance, which the round critic called the flattest close-up in the
       * garden. A real maze coral drifts warm and cool across a colony at the
       * scale its valleys meander, so a second fbm at that scale (period 3
       * against the meander's warp field at 4) moves the tone a step either
       * way and tilts the hue with it: warm patches shed a little green and
       * blue, cool ones gain them back. The drift is hue-scale, not
       * value-scale — the instance colour still owns which rose or ochre the
       * colony is. The map is the one procedural surface this package can
       * reach on the live brain (the geometry is Blender's), which is why the
       * variety lives here and not in `brainGeometry`'s paint.
       */
      const height = (u: number, v: number): number =>
        fbm(u, v, { seed, period: 16, octaves: 3 }) * 0.7 +
        fbm(u, v, { seed: seed ^ 0x2f11, period: 48, octaves: 2 }) * 0.3;
      const mottle = (u: number, v: number): number =>
        fbm(u, v, { seed: seed ^ 0x6b17, period: 3, octaves: 2 });
      return {
        height,
        tone: (u, v) => 0.82 + height(u, v) * 0.16 + (mottle(u, v) - 0.5) * 0.12,
        tint: (u, v) => {
          const warm = mottle(u, v) - 0.5;
          return [1, 0.99 - warm * 0.05, 0.96 - warm * 0.12];
        },
        strength: 0.05,
      };
    }
    case "plateStack": {
      /**
       * The plate's faces are laid out as a disc: a cylinder cap's UVs run out
       * from (0.5, 0.5) to a circle of radius 0.5, and the rim band takes the
       * square around it. So growth structure has to be authored in polar
       * coordinates about that centre. Banding straight down `v` — the obvious
       * reading of "concentric" — comes out as parallel stripes across the
       * plate, which is corduroy, and corduroy is upholstery.
       *
       * What a plate coral actually shows is branchlets radiating from the
       * stalk, crossed by the growth rings the colony laid down as it spread.
       * Outside the inscribed circle nothing but the rim band samples, so that
       * region crossfades to plain noise — which keeps the whole tile seamless
       * where the band wraps.
       */
      const height = (u: number, v: number): number => {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const radius = Math.hypot(dx, dy) * 2;
        const angle = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;

        const rings = Math.sin(radius * Math.PI * 2 * 6) * 0.5 + 0.5;
        // Branchlets, jittered in both spacing and depth: evenly spaced ribs of
        // equal depth are a parasol, which is the table's failure with a
        // different outline. The jitter is itself periodic in the angle, so the
        // rim band still wraps.
        const jitter = fbm(angle, 0.5, { seed: seed ^ 0x91c3, period: 5, octaves: 2 });
        const depth = 0.45 + fbm(angle, 0.5, { seed: seed ^ 0x33d7, period: 3, octaves: 2 }) * 0.8;
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
        tone: (u, v) => {
          const radius = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2);
          // 0.16 since W-N5, from 0.26: the map darkened the outer band at
          // the same time the vertex colours now lighten the growth margin,
          // and the two were cancelling — the margin has to win or the plate
          // stays one flat value.
          return (0.56 + height(u, v) * 0.58) * (1 - 0.16 * radius * radius);
        },
        strength: 0.05,
      };
    }
    case "tube": {
      // A sponge's wall is a felt of fine vertical channels broken by grain
      // and scattered ostia — not staves. The old map ran 14 grooves at half
      // the tone's whole swing, and 14 evenly-spaced dark flutes around a
      // flared vessel is barrel construction; the round critic read it as
      // exactly that (W-N5). The channels are finer and shallower now, the
      // grain carries most of the surface, and small pale pore rims replace
      // the flute shadows. The vertical shading term is gone with them — the
      // foot-to-lip story lives in the vertex colours (`paintTube`), and a
      // map's `v` runs down the throat too, where "deepest at the foot" was
      // quietly brightening the floor of the mouth.
      const height = (u: number, v: number): number => {
        const pores = 1 - Math.min(1, voronoi(u, v, 10, seed ^ 0x0577).f1 / 0.06);
        return (
          (Math.sin(u * Math.PI * 2 * 18) * 0.5 + 0.5) * 0.2 +
          fbm(u, v, { seed, period: 9, octaves: 3 }) * 0.62 +
          pores * 0.18
        );
      };
      return {
        height,
        tone: (u, v) => 0.66 + height(u, v) * 0.3,
        strength: 0.06,
      };
    }
    case "fan": {
      // Never reached: the fan's map is its own painted or generated sheet, and
      // it is the one surface in the garden whose alpha carries a silhouette.
      throw new Error("fan: use fanTexture()");
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled coral shape: ${String(exhaustive)}`);
    }
  }
}

/* ------------------------------------------------------------------ *
 *  The sea fan's sheet
 * ------------------------------------------------------------------ */

/**
 * Where a pixel stops being water and starts being lace.
 *
 * The painting is a fan on black, so its luminance *is* its coverage, and
 * these are the two ends of the ramp between them in parts of 255. The low end
 * is above the black field's own dither; the high end is below the darkest
 * pigment in the painting (its veins measure around 145 of luma against a p90
 * of 175), because anything that clips the interior punches holes in the fan
 * rather than trimming its edge.
 */
const FAN_ALPHA_LOW = 16;
const FAN_ALPHA_HIGH = 90;

/** The alpha a fragment has to clear to be drawn at all; see `CoralField`. */
export const FAN_ALPHA_TEST = 0.45;

const FAN_TEXTURE_SIZE = 256;

let generatedFan: DataTexture | undefined;

/**
 * The generated sea fan, for the build with no `public/assets`.
 *
 * It is a lace rather than a leaf for the same reason the painting is: a
 * gorgonian is mostly holes, and what makes one read at any distance is water
 * showing through it. Ribs radiate from the root and bifurcate — the frequency
 * doubles at fixed distances rather than climbing smoothly, because a smooth
 * climb spirals the ribs and a doubling forks them — crossed by the fine links
 * that turn a spray of branches into a mesh.
 */
export function fanTexture(): DataTexture {
  if (generatedFan) {
    return generatedFan;
  }

  const size = FAN_TEXTURE_SIZE;
  const data = new Uint8Array(size * size * 4);
  const seed = SHAPE_SEED ^ 0x0f_a17;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const [r, g, b, a] = fanSample(u, v, seed);
      const i = (y * size + x) * 4;
      data[i] = Math.round(clamp01(r) * 255);
      data[i + 1] = Math.round(clamp01(g) * 255);
      data[i + 2] = Math.round(clamp01(b) * 255);
      data[i + 3] = Math.round(clamp01(a) * 255);
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  generatedFan = texture;
  return texture;
}

function fanSample(u: number, v: number, seed: number): [number, number, number, number] {
  // The root sits just inside the bottom edge, where the quad meets the sand.
  const dx = u - 0.5;
  const dy = v - 0.05;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  // The colony's outline: a disc centred above the root, softened at the rim
  // so the outermost branchlets thin out instead of being cut off square.
  const outline = 1 - smoothStep(0.34, 0.46, Math.hypot(dx, v - 0.5));

  // Ribs. The frequency doubles at fixed radii — a fork — rather than climbing
  // with distance, which would wind every branch into a spiral.
  const level = Math.floor(Math.log2(Math.max(1, distance * 14)));
  const frequency = 5 * 2 ** level;
  const wander = (fbm(u, v, { seed, period: 6, octaves: 2 }) - 0.5) * 0.35;
  const rib = 1 - smoothStep(0.06, 0.3, Math.abs(Math.sin((angle + wander) * frequency)));
  // Links across the ribs, which is what makes a fan a mesh and not a broom.
  const link = (1 - smoothStep(0.05, 0.22, Math.abs(Math.sin(distance * 120)))) * 0.85;
  // The holdfast: a short stem below the colony, thickening into the sand.
  const stem = v < 0.12 ? 1 - smoothStep(0.012, 0.03, Math.abs(dx)) : 0;

  const alpha = clamp01(Math.max(Math.min(rib, 1), Math.min(rib, link)) * outline + stem);

  // Near-neutral and pale, so the instance tint carries the hue: three
  // colour families grow on one sheet. The grain is the pigment's own tooth.
  const grain = 0.92 + fbm(u * 3, v * 3, { seed: seed ^ 0x33, period: 12, octaves: 2 }) * 0.16;
  const value = grain * (0.86 + distance * 0.18);
  return [value, value * 0.97, value * 0.95, alpha];
}

let paintedFan: Texture | undefined | null;

/**
 * The painted fan, unpacked from its black field.
 *
 * Three transforms, and each one is answering a specific failure.
 *
 * **Alpha from luminance.** The image is a fan painted on black and there is no
 * alpha channel in it, so its own brightness is its coverage. With
 * `alphaTest` and no blending this costs nothing per frame and keeps the piece
 * in the opaque queue, which is what stops forty overlapping fans needing to be
 * sorted against each other every time the camera turns.
 *
 * **Divide the colour back out of the coverage.** This is the halo, and it is
 * the one thing here that would be visible from across the room if it were
 * skipped. A pixel on the edge of a painted stroke is the pigment *composited
 * over black*, so it holds roughly colour × coverage — at half coverage it is
 * half as bright as the lace it belongs to. Cut at `alphaTest` and every
 * surviving edge pixel is a dark one, which draws a fringe around every
 * branchlet: the fan gets a soot outline against bright water and the whole
 * piece reads a value darker than it is. Dividing by the coverage recovers the
 * pigment, and the fringe goes with it.
 *
 * **Level it onto the generated sheet's mean.** The same correction
 * `levelToBlade` makes for the grass: this painting brings a rose of its own,
 * and the instances are tinted rose, coral and violet. Multiplied together
 * the violets come out brown. Scaling the painting per channel onto the mean
 * the generated sheet was authored at leaves its *variation* — the vein
 * structure, the pigment tooth — and hands the hue back to the instance
 * colour. The mean is alpha-weighted, because four fifths of this file is
 * black field that is never drawn and would drag any flat average to nothing.
 */
export function unpackFan(texture: Texture): Texture | null {
  if (paintedFan !== undefined) {
    return paintedFan;
  }
  const source = readImage(texture);
  paintedFan = source ? textureFromPixels(levelFan(alphaFromLuma(source)), texture) : null;
  return paintedFan;
}

const paintedWashes = new Map<CoralKind, Texture | null>();

/**
 * The painted wash for a skinned coral, levelled and memoised.
 *
 * One transform, and it is the correction every painted tile in this project
 * makes on arrival: the strip is scaled per channel onto the generated skin's
 * own mean, so the *value* the garden was composed at and the near-neutrality
 * that keeps the instance colour the hue owner are both properties of the
 * code rather than promises about the file. The strips are painted
 * near-neutral by design (the brain's measures 222/213/206 of sRGB), but
 * "near" is a dozen parts warmer than the generated map's 0.99/0.96 tint, and
 * a dozen parts multiplied into every rose, ochre and violet in the garden is
 * a hue shift nobody chose. What survives the levelling is the painting's
 * variation — the meander, the rings — which is the whole reason it exists.
 *
 * The normal map is deliberately not replaced: the strips are colour and
 * nothing else, WP-G6's whole-asset contract, and the corallite grain the
 * procedural normal carries is form the painting has no channel for.
 */
export function unpackCoralWash(kind: CoralKind, texture: Texture): Texture | null {
  const cached = paintedWashes.get(kind);
  if (cached !== undefined) {
    return cached;
  }
  const source = readImage(texture);
  const unpacked = source
    ? textureFromPixels(levelWash(source, coralSkin(kind).map), texture)
    : null;
  paintedWashes.set(kind, unpacked);
  return unpacked;
}

/**
 * Scales a full-coverage sheet onto a generated map's mean, per channel.
 *
 * `weightedMean` rather than a bespoke flat mean: both images carry alpha 255
 * everywhere (a wash has no cut-out), so the alpha weighting is exact and the
 * fan's helper serves unchanged.
 */
function levelWash(sheet: ImageData, onto: DataTexture): ImageData {
  const target = weightedMean(onto.image.data as Uint8Array);
  const painted = weightedMean(sheet.data);

  for (let c = 0; c < 3; c++) {
    const scale = (target[c] ?? 0) / Math.max(1, painted[c] ?? 1);
    for (let i = c; i < sheet.data.length; i += 4) {
      const value = (sheet.data[i] ?? 0) * scale;
      sheet.data[i] = value > 255 ? 255 : value;
    }
  }
  return sheet;
}

function alphaFromLuma(source: ImageData): ImageData {
  const { width, height, data } = source;
  const out = new ImageData(width, height);

  for (let y = 0; y < height; y++) {
    // The fan is painted root-down and the texture's `v` runs root to tip with
    // `flipY` off, so row 0 of the output is the last row of the painting.
    const row = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const from = (row * width + x) * 4;
      const to = (y * width + x) * 4;
      const r = data[from] ?? 0;
      const g = data[from + 1] ?? 0;
      const b = data[from + 2] ?? 0;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const alpha = smoothStep(FAN_ALPHA_LOW, FAN_ALPHA_HIGH, luma);
      // Below the ramp there is no pigment to recover, so leave the pixel
      // alone rather than dividing by nearly nothing and amplifying dither.
      const recover = alpha > 0.02 ? 1 / alpha : 0;
      out.data[to] = Math.min(255, r * recover);
      out.data[to + 1] = Math.min(255, g * recover);
      out.data[to + 2] = Math.min(255, b * recover);
      out.data[to + 3] = Math.round(alpha * 255);
    }
  }

  return out;
}

/** Scales a sheet onto the generated fan's alpha-weighted mean, per channel. */
function levelFan(sheet: ImageData): ImageData {
  const target = weightedMean(fanTexture().image.data as Uint8Array);
  const painted = weightedMean(sheet.data);

  for (let c = 0; c < 3; c++) {
    const scale = (target[c] ?? 0) / Math.max(1, painted[c] ?? 1);
    for (let i = c; i < sheet.data.length; i += 4) {
      const value = (sheet.data[i] ?? 0) * scale;
      sheet.data[i] = value > 255 ? 255 : value;
    }
  }

  return sheet;
}

function weightedMean(data: ArrayLike<number>): number[] {
  const total = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = (data[i + 3] ?? 0) / 255;
    weight += alpha;
    for (let c = 0; c < 3; c++) {
      total[c] = (total[c] ?? 0) + (data[i + c] ?? 0) * alpha;
    }
  }
  return total.map((sum) => sum / Math.max(1e-6, weight));
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
