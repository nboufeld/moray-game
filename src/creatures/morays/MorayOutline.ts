import { BackSide, Color, Mesh, MeshBasicMaterial, SkinnedMesh } from "three";

/**
 * The contour line the morays wear, and nothing else does.
 *
 * A Ghibli background carries no line at all — the rocks, the sand, the coral
 * and the water are painted shapes meeting each other — and the characters
 * drawn over it do. That split is the whole of this file: it is called from
 * `Moray` and from nowhere else, so the reef cannot quietly grow outlines, and
 * the animals cannot quietly lose them in the sanctuary or in a codex plate,
 * since all three build the same class.
 *
 * It is an inverted hull, which on a skinned character is the one technique
 * that costs nothing per frame: a second copy of the same geometry, expanded
 * along its normals, rendered back faces only. Wherever the copy is behind the
 * original the depth test hides it, and the only place it survives is the
 * width it was expanded by, past the silhouette. There is no screen-space edge
 * detect and no second render target — and, crucially, it is *animated*,
 * because it is bound to the very same {@link SkinnedMesh.skeleton} the animal
 * is. The line follows the wave down the body for free.
 *
 * Two things it deliberately does not do. It does not cast shadows: it is a
 * drawn line, and a line has no shadow — it would also double the shadow pass's
 * work on the one subject in the reef that is skinned. And it does not
 * intercept anything: the sightline test in `Game.isObstructed` raycasts
 * `Reef.obstructionMeshes` — rock, never creature — so nothing here can
 * obstruct the discovery the game is built around.
 */

/**
 * How far the hull stands off the skin, in the animal's own metres.
 *
 * The reef scales its morays by about half again and the sanctuary scales its
 * residents down toward one, so this is deliberately expressed in local space:
 * the line then thickens and thins *with* the animal, which is what a drawn
 * contour does. Everything about the value is a compromise between the two
 * ranges the game shows a moray at — four to seven metres in a crevice, and
 * one metre in a codex plate.
 */
const HULL_THICKNESS = 0.012;

/**
 * What the line is made of: the species' own body colour, most of the way to
 * one of two inks — a dark blue-violet, or a warm cream.
 *
 * Neither is black or white, for the reason the whole value key exists: the
 * darkest thing in this world is a colour and so is the lightest. And neither
 * is used neat, because a line mixed from the animal it belongs to keeps the
 * zebra's cool and the dragon's warm, which is the difference between a drawing
 * and a decal.
 *
 * There are two of them because a line is a value and no value reads against
 * itself. One dark ink was fine for a cream snowflake and quietly useless on
 * the animals that need a contour most: the zebra is a near-black eel in a
 * violet crevice, and mixing its body 60% toward an ink *lighter than the body*
 * produced a line four hundredths of a step off it — present in the buffer,
 * invisible in the frame. Measured across the four species in the value the
 * palette was picked in, the single dark ink separated the snowflake's line
 * from its body by 0.43 and the zebra's by 0.045.
 *
 * Lining a dark subject light is also simply what the reference does. A cel
 * character's contour is dark on a pale face and pale on a black one, for
 * exactly this reason and with no more theory behind it than that.
 */
const HULL_INK = 0x27354f;
const HULL_HALO = 0xf2e8d0;
const HULL_MIX = 0.6;

/** Exposed so a test can check the mix without writing the values down twice. */
export const OUTLINE_INK = HULL_INK;
export const OUTLINE_HALO = HULL_HALO;

/** What every hull mesh is called, so a probe can take the line out of a frame. */
export const OUTLINE_NAME = "moray-outline";

/** Exposed for the tests that check the line follows the animal it belongs to. */
export const OUTLINE_THICKNESS = HULL_THICKNESS;

/**
 * Push every vertex out along its own normal, in object space.
 *
 * Object space rather than view space is what makes this work on a skinned
 * mesh with an untouched `MeshBasicMaterial`: `begin_vertex` runs *before*
 * `skinning_vertex`, so the offset is carried through the bone transform with
 * the vertex it belongs to and the shell bends with the body. Offsetting in
 * view space instead would need the skinned normal, which the basic shader only
 * computes for its own reasons and which no chunk here is guaranteed to see.
 *
 * The thickness is baked into the source rather than passed as a uniform on
 * purpose: three keys its program cache on `onBeforeCompile.toString()`, so one
 * constant string is one program shared by every moray in the scene.
 */
const HULL_CHUNK = /* glsl */ `
  #include <begin_vertex>
  transformed += normalize( normal ) * ${HULL_THICKNESS};
`;

const inflate: MeshBasicMaterial["onBeforeCompile"] = (shader) => {
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", HULL_CHUNK);
};

/**
 * Perceived value, on numbers that are already in sRGB.
 *
 * Deliberately not `Color.getLuminance`, which reads the linear working space
 * and is a different question: this one is asking which of two inks a painter
 * would say is further from the animal, and a painter is looking at the encoded
 * value. The two disagree sharply down at the zebra's end of the range, which
 * is the end where the choice is actually made.
 */
function value(srgb: Color): number {
  return 0.2126 * srgb.r + 0.7152 * srgb.g + 0.0722 * srgb.b;
}

/**
 * The line's colour: the body mixed toward whichever ink stands furthest from
 * it in value, in sRGB.
 *
 * Furthest, rather than a threshold on the body's own darkness. A threshold
 * needs a number picked between two species and re-picked whenever a fifth is
 * added, and this needs neither — it falls out of the two inks, so a species is
 * still a data change and a repainted ink moves every animal's line with it.
 * It also cannot produce the one outcome that would be worse than either ink,
 * which is a *blend* of them: interpolating the ink by body luminance would
 * hand a mid-valued animal a mid-valued line, and that is the failure this
 * exists to fix, arrived at deliberately.
 *
 * As it lands: the snowflake keeps the dark line and the other three take the
 * halo. The ribbon is the one that is not obvious by eye — an electric blue is
 * read as a bright colour — but it is a mid-dark *value*, and the dark ink
 * separated it by 0.13 against the halo's 0.30. What it wears is a pale blue,
 * being 40% of its own body still.
 *
 * The mix is in sRGB for the same reason as `softenAccent`: these palettes were
 * picked in the space a painter reads, and three's working space is linear,
 * where the same fraction is a far deeper cut. Mixed linearly, the snowflake —
 * a cream animal — comes out with a line two thirds of the way back to its own
 * body value, which is a smudge rather than a contour.
 */
function inkFor(bodyColor: number): Color {
  const body = new Color(bodyColor).convertLinearToSRGB();
  const dark = new Color(HULL_INK).convertLinearToSRGB();
  const halo = new Color(HULL_HALO).convertLinearToSRGB();

  const level = value(body);
  const ink =
    Math.abs(value(halo) - level) > Math.abs(value(dark) - level) ? halo : dark;
  return body.lerp(ink, HULL_MIX).convertSRGBToLinear();
}

export interface MorayOutlineParts {
  /**
   * The animal's skinned meshes — the body tube and the dorsal fin. Their hulls
   * share their geometry, their skeleton and their bind matrix, so there is no
   * second copy of anything and no second pose to keep in step.
   */
  readonly skinned: readonly SkinnedMesh[];
  /**
   * The rigid head primitives that carry the face's silhouette. The eyes and
   * their catchlights are not among them: the catchlight is a bloom source
   * wearing a sphere rather than a drawn object, and a contour around a bead
   * already the darkest note on the animal would only close the one spark the
   * discovery moment is built around.
   */
  readonly rigid: readonly Mesh[];
}

/**
 * Adds a back-faced shell to each part, beside the part itself.
 *
 * Every hull is a sibling of what it outlines rather than a child, so nothing
 * in the animal's own hierarchy moves: `getHeadWorldPosition`, the focus cone
 * and the portrait's framing all read the same numbers they did before.
 */
export function addMorayOutline(bodyColor: number, parts: MorayOutlineParts): void {
  const material = new MeshBasicMaterial({ color: inkFor(bodyColor), side: BackSide });
  material.onBeforeCompile = inflate;

  for (const source of parts.skinned) {
    const hull = new SkinnedMesh(source.geometry, material);
    // The same bounds the surface carries. Three would otherwise bound a
    // skinned mesh from the first pose it happens to be drawn in and never
    // again; the source's sphere already has the slack for every pose the rig
    // can reach, and a shell twelve millimetres proud of it is well inside
    // that. Culled together with the animal, which is the point — a body in
    // frame with its line culled would be a body that lost its outline.
    hull.boundingSphere = source.boundingSphere?.clone() ?? null;
    attach(source, hull);
    // The bind matrix is copied rather than recomputed from the hull's own
    // world matrix: it is the pose the skeleton's inverses were taken in, and
    // taking it from the source is exact whatever order the animal was
    // assembled in.
    hull.bind(source.skeleton, source.bindMatrix);
  }

  for (const source of parts.rigid) {
    // The node's scale is baked into the copy instead of carried on the hull.
    // A head is built from squashed and stretched primitives — a brow is nearly
    // twice as wide as it is deep — and a constant push along an object-space
    // normal under a non-uniform scale is a line that is twice as thick down
    // one axis as the other. Baking it leaves the hull at unit scale, where the
    // push means the same thing in every direction. `applyMatrix4` takes the
    // normals through with it, so they stay unit length and stay perpendicular.
    const geometry = source.geometry.clone();
    geometry.scale(source.scale.x, source.scale.y, source.scale.z);
    const hull = new Mesh(geometry, material);
    hull.position.copy(source.position);
    hull.quaternion.copy(source.quaternion);
    attach(source, hull);
  }
}

function attach(source: Mesh, hull: Mesh): void {
  hull.name = OUTLINE_NAME;
  // Explicit, and load-bearing: `Moray` turns shadow casting on for every mesh
  // under its root, and a shell that cast one would fatten the animal's shadow
  // by its own thickness and pay for a second skinned pass to do it.
  hull.castShadow = false;
  hull.receiveShadow = false;
  source.parent?.add(hull);
}
