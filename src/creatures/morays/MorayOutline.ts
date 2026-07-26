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
 * What the line is made of: the species' own body colour, most of the way to a
 * dark blue-violet.
 *
 * Not black, for the reason the whole value key exists — the darkest thing in
 * this world is a colour. And not one shared ink either: a line mixed from the
 * animal it belongs to keeps the zebra's line cool and the dragon's warm, which
 * is the difference between a drawing and a decal.
 */
const HULL_INK = 0x27354f;
const HULL_MIX = 0.6;

/** Exposed so a test can check the mix without writing the value down twice. */
export const OUTLINE_INK = HULL_INK;

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
 * The line's colour, mixed in sRGB.
 *
 * The same reasoning as `softenAccent`: these palettes were picked in the space
 * a painter reads, and three's working space is linear, where the same fraction
 * is a far deeper cut. Mixed linearly, the snowflake — a cream animal — comes
 * out with a line two thirds of the way back to its own body value, which is a
 * smudge rather than a contour.
 */
function inkFor(bodyColor: number): Color {
  const ink = new Color(HULL_INK).convertLinearToSRGB();
  return new Color(bodyColor).convertLinearToSRGB().lerp(ink, HULL_MIX).convertSRGBToLinear();
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
