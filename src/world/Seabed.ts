import { PlaneGeometry } from "three";

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
