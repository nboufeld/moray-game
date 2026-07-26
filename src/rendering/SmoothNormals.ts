import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute } from "three";

/**
 * Averages a geometry's normals across vertices that occupy the same point,
 * without moving any of them.
 *
 * `computeVertexNormals` cannot do this on the shapes the reef is built from.
 * Everything out of `PolyhedronGeometry` — every icosahedron and dodecahedron
 * here — is non-indexed, so each triangle owns its three vertices outright and
 * the "vertex" normal three computes for them is the face normal. A box is
 * indexed but splits its corners per face, which comes to the same thing. That
 * is why turning `flatShading` off on a rock changes nothing on its own: the
 * facets are in the buffer, not in the material.
 *
 * So the weld is by *position*, which is the only thing the two copies of a
 * shared edge still agree on. Quantising to a tenth of a millimetre is what
 * makes the lookup exact — the displaced coordinates are floats arrived at
 * along different arithmetic paths in each face, and a hash on the raw bits
 * would find no neighbours at all.
 *
 * Positions and indices are untouched by construction, which is the whole
 * reason this exists rather than a `mergeVertices` pass: the crevice mounds are
 * raycast for line of sight, and a normal cannot move a ray.
 */
const WELD_SCALE = 1e4;

type Attribute = BufferAttribute | InterleavedBufferAttribute;

function weldKey(position: Attribute, index: number): string {
  const x = Math.round(position.getX(index) * WELD_SCALE);
  const y = Math.round(position.getY(index) * WELD_SCALE);
  const z = Math.round(position.getZ(index) * WELD_SCALE);
  return `${x},${y},${z}`;
}

export function smoothNormals(geometry: BufferGeometry): void {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  if (!position || !normal) {
    return;
  }

  const sums = new Map<string, [number, number, number]>();
  const keys: string[] = new Array<string>(position.count);

  for (let i = 0; i < position.count; i++) {
    const key = weldKey(position, i);
    keys[i] = key;
    const sum = sums.get(key);
    if (sum) {
      sum[0] += normal.getX(i);
      sum[1] += normal.getY(i);
      sum[2] += normal.getZ(i);
    } else {
      sums.set(key, [normal.getX(i), normal.getY(i), normal.getZ(i)]);
    }
  }

  for (let i = 0; i < position.count; i++) {
    const sum = sums.get(keys[i]!);
    if (!sum) {
      continue;
    }
    const length = Math.hypot(sum[0], sum[1], sum[2]);
    // A fold thin enough for its two faces to cancel has no smooth normal to
    // give; leaving the face normal there is the only answer that is not black.
    if (length < 1e-6) {
      continue;
    }
    normal.setXYZ(i, sum[0] / length, sum[1] / length, sum[2] / length);
  }

  normal.needsUpdate = true;
}
