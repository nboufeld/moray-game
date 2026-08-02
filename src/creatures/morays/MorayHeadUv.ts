import { Float32BufferAttribute, Matrix4, Vector3, type Mesh, type Object3D } from "three";

/**
 * The quarter turn from the belly, and as far around as an underside part is
 * allowed to wrap.
 *
 * A cap rather than a fold back toward the belly: it is monotone, so nothing
 * turns around and no crease appears anywhere the outside of the jaw can be
 * seen, and what it holds the surface at is the tone of the flank it is
 * continuous with. Everything it affects is inside the mouth, which the map has
 * no pixels for and which no choice here can be right about.
 */
const FLANK_U = 0.25;

/**
 * Wraps the head's parts in the front of the body's skin.
 *
 * The head is sculpted from primitives — a sphere for the cranium, a cylinder
 * for the snout, a squashed sphere for the brow, another cylinder for the upper
 * jaw — and every one of them arrives carrying the texture coordinates its
 * generator authored. Those are the wrong space entirely. A sphere's `v` runs
 * pole to pole, so a skull twenty centimetres across wore the *whole* length of
 * a map painted from snout to tail tip, and its `u` winds about the sphere's
 * own Y axis, which is the animal's dorsal-ventral axis — so the counter-shading
 * that should darken the back and lift the belly ran a quarter turn out, up one
 * cheek and down the other. Against the low-contrast procedural skin that read
 * as detail. Against a painted one it is a densely striped ball on the end of a
 * boldly banded body, which is the zebra's head today.
 *
 * So the head is re-projected into the same space the tube is built in
 * (`MorayBody`): `u` around the body's long axis and `v` along it.
 *
 * The lower jaw is projected with the rest of it, and held to the belly side of
 * the wrap. It hangs below the axis, so the angle already measures most of it
 * out at the bottom — `u` near 0 down the chin, out to about 0.18 at its widest
 * — which is the belly side of the head's band and exactly where a moray's pale
 * throat belongs. The exception is the hinge, which is fat enough to cross the
 * axis: the crown of its rear ring sits a centimetre *above* the spine line and
 * scores `u = 0.5`, while the same ridge at the front of the jaw scores 0, so
 * the map's entire belly-to-spine sweep ran along the jaw's top over its own
 * length. That is a fan of stretched pattern the width of the mouth, and it was
 * plainly visible on the animal — an open jaw shows the eye a good deal of its
 * upper surface. {@link FLANK_U} caps the wrap there instead.
 *
 * The jaw is also the one part of the head that moves: a mesh inside a pivot
 * the ventilation rhythm rotates. That costs nothing here, because the
 * projection is taken in the rest pose and written into the geometry once. UVs
 * do not follow a bone, so the jaw carries its slice of the map open or shut.
 *
 * **`v` — a band at the front of the map.** The tube's `v` is linear in `z` and
 * reaches 0 at its own nose ring, which sits inside the skull; `neckV` is the
 * value it carries at the body root, where the head group stands. So the head
 * is given `v = 0` at the frontmost point of the snout, rising to `neckV` at
 * that root and continuing past it for the sliver of skull behind — which puts
 * the whole head in the first few percent of the map, reading as its head end,
 * and leaves head and neck agreeing where they meet. The head is about three
 * times longer than the slice of map it now wears, so its markings come out
 * coarser than the body's. That is the intended trade and the same one the
 * painted maps already make along `v`: a stretched band of the right pattern is
 * an animal, and the entire pattern crushed onto a skull is not.
 *
 * **`u` — mirrored rather than wound.** The circumferential angle is measured
 * exactly as the tube measures it (0 at the belly, 0.5 at the spine), but the
 * head takes its absolute value, so the two flanks are mirror images. That is
 * not a shortcut, it is the only seamless option here: a wound `u` has to jump
 * from 1 back to 0 somewhere, and on a Y-poled sphere no such cut can be hidden
 * — the cut has to run from the nose to the neck through the belly, while the
 * sphere's own duplicated seam column runs from spine to belly, so the jump
 * would land *inside* a quad and squeeze the entire map into a hand's width of
 * garbage down the underside of every skull. Mirroring has no jump anywhere:
 * `u` simply turns around at the belly and at the spine, which are precisely
 * the two lines a map painted to this contract is symmetric about. The animal
 * is bilaterally symmetric, so is its face.
 *
 * Only texture coordinates are written. Positions, transforms and therefore
 * `getHeadWorldPosition` — which the focus cone, the sightline raycast and the
 * discovery system are all tuned against — are untouched.
 *
 * @param head The head group; every part is projected in this object's frame,
 * so a part's own offset and rotation inside the head are accounted for.
 * @param parts The meshes wearing the body material, in whatever frames they
 * sit in inside the head. The eyes and their catchlights have their own
 * materials and are not among them.
 * @param neckV The body tube's `v` where the head meets it; see
 * `MorayBodyGeometry.neckV`.
 * @param underside Parts that hang below the tube's axis and are held to the
 * belly side of the wrap; see {@link FLANK_U}. Projected in the same pass as
 * the rest, so they share its `v` band and its nose.
 */
export function projectHeadUvs(
  head: Object3D,
  parts: readonly Mesh[],
  neckV: number,
  underside: readonly Mesh[] = [],
): void {
  head.updateMatrixWorld(true);
  const toHead = new Matrix4().copy(head.matrixWorld).invert();
  const all = [...parts, ...underside];
  const partToHead = all.map((part) => new Matrix4().multiplyMatrices(toHead, part.matrixWorld));

  const point = new Vector3();

  // One mapping for the whole head, so the parts agree with each other where
  // they overlap: the snout is set into the skull and the brow sits on it.
  let noseZ = 0;
  for (let i = 0; i < all.length; i++) {
    const position = all[i]!.geometry.getAttribute("position");
    const matrix = partToHead[i]!;
    for (let vertex = 0; vertex < position.count; vertex++) {
      point.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
      noseZ = Math.max(noseZ, point.z);
    }
  }
  if (noseZ <= 0) {
    return;
  }

  for (let i = 0; i < all.length; i++) {
    const geometry = all[i]!.geometry;
    const position = geometry.getAttribute("position");
    const matrix = partToHead[i]!;
    const limit = i < parts.length ? 0.5 : FLANK_U;
    const uvs = new Float32Array(position.count * 2);

    for (let vertex = 0; vertex < position.count; vertex++) {
      point.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
      // The tube puts the belly at -y and the spine at +y, so this is the same
      // angle it builds its ring from; the absolute value is the mirror.
      const angle = Math.abs(Math.atan2(point.x, -point.y));
      uvs[vertex * 2] = Math.min(angle / (Math.PI * 2), limit);
      uvs[vertex * 2 + 1] = neckV * (1 - point.z / noseZ);
    }

    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  }
}
