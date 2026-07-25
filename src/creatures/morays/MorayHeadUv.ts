import { Float32BufferAttribute, Matrix4, Vector3, type Mesh, type Object3D } from "three";

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
 * @param parts The meshes wearing the body material. The eyes, the catchlights
 * and the lower jaw have their own materials and are not among them.
 * @param neckV The body tube's `v` where the head meets it; see
 * `MorayBodyGeometry.neckV`.
 */
export function projectHeadUvs(head: Object3D, parts: readonly Mesh[], neckV: number): void {
  head.updateMatrixWorld(true);
  const toHead = new Matrix4().copy(head.matrixWorld).invert();
  const partToHead = parts.map((part) => new Matrix4().multiplyMatrices(toHead, part.matrixWorld));

  const point = new Vector3();

  // One mapping for the whole head, so the parts agree with each other where
  // they overlap: the snout is set into the skull and the brow sits on it.
  let noseZ = 0;
  for (let i = 0; i < parts.length; i++) {
    const position = parts[i]!.geometry.getAttribute("position");
    const matrix = partToHead[i]!;
    for (let vertex = 0; vertex < position.count; vertex++) {
      point.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
      noseZ = Math.max(noseZ, point.z);
    }
  }
  if (noseZ <= 0) {
    return;
  }

  for (let i = 0; i < parts.length; i++) {
    const geometry = parts[i]!.geometry;
    const position = geometry.getAttribute("position");
    const matrix = partToHead[i]!;
    const uvs = new Float32Array(position.count * 2);

    for (let vertex = 0; vertex < position.count; vertex++) {
      point.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
      // The tube puts the belly at -y and the spine at +y, so this is the same
      // angle it builds its ring from; the absolute value is the mirror.
      const angle = Math.abs(Math.atan2(point.x, -point.y));
      uvs[vertex * 2] = angle / (Math.PI * 2);
      uvs[vertex * 2 + 1] = neckV * (1 - point.z / noseZ);
    }

    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  }
}
