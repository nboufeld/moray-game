import { BufferAttribute, PlaneGeometry } from "three";

/**
 * Gentle dunes, as layered sines rather than noise so the shape is exactly
 * reproducible and cheap to sample from anywhere.
 *
 * Amplitude is deliberately small. The diver's floor, the rock placements and
 * the crevice mounds were all authored against a flat seabed, so the dunes have
 * to read as relief without lifting anything off the ground or poking through
 * the camera's minimum height.
 */
export function seabedHeight(x: number, z: number): number {
  return (
    0.34 * Math.sin(x * 0.075) * Math.cos(z * 0.065) +
    0.18 * Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.17) +
    0.07 * Math.sin(x * 0.41) * Math.sin(z * 0.35 + 0.6)
  );
}

/**
 * A dune-displaced ground plane, already rotated into the XZ plane.
 * `lift` raises the whole sheet, which the caustics overlay uses to sit just
 * clear of the sand it is projected onto.
 */
export interface ContactPatch {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly strength: number;
}

/**
 * Bakes soft occlusion into the seabed's vertex colours: dune troughs sit in
 * shade, and everything resting on the sand gets a contact ring beneath it.
 *
 * A contact shadow is what visually attaches an object to the ground. Without
 * one, rocks and coral read as decals hovering above the seabed no matter how
 * well the sand itself is textured — and shadow mapping alone will not supply
 * it for the many objects here that deliberately do not cast.
 */
export function bakeSeabedOcclusion(
  geometry: PlaneGeometry,
  contacts: readonly ContactPatch[],
): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);

    // Troughs of the dune field hold a little more shade than the crests.
    const relief = seabedHeight(x, z);
    let shade = 0.9 + relief * 0.22;

    for (const contact of contacts) {
      const distance = Math.hypot(x - contact.x, z - contact.z);
      if (distance < contact.radius) {
        const falloff = 1 - distance / contact.radius;
        shade *= 1 - contact.strength * falloff * falloff;
      }
    }

    const value = Math.max(0.25, Math.min(1.2, shade));
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value;
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

export function createSeabedGeometry(size: number, segments: number, lift = 0): PlaneGeometry {
  const geometry = new PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  if (position) {
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, seabedHeight(x, z) + lift);
    }
    position.needsUpdate = true;
  }
  geometry.computeVertexNormals();

  return geometry;
}
