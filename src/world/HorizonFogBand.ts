import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
} from "three";

/**
 * `HorizonFogBand` — the horizon-step class fix (edges-fix, punch #3's
 * residual; the calamity last-grove division, pale-10's band edges, the
 * wall-crossing two-tone).
 *
 * The defect class the HorizonCurtain kit could not reach: a flat world's
 * horizon is a razor-straight line, and it prints wherever fully-fogged
 * ground meets the painted backdrop at a different value. At base mood
 * the two agree by construction — `UnderwaterFog` samples the fog colour
 * off the painting's horizon strip — but every region and wing mood
 * re-colours the FOG (`colorScale` lerp) while the backdrop only DIMS
 * (`backdropFade`), so under any mood the two drift apart and the line
 * returns. No curtain can dress it (the calamity ruin curtains stand
 * beyond the far clip from every shelf stand), and no fog density can
 * close it: the mismatch is fog-vs-backdrop, not fog-vs-surface.
 *
 * The cure is the harmony the hard-geometry ledger flagged for, made
 * geometric: one camera-following cylinder at 150 m whose ink is copied
 * from `scene.fog` every frame, alpha 1 well below eye level and
 * dissolved to nothing a few degrees above it. Below the world's horizon
 * it is invisible by construction — it paints fog colour over surfaces
 * the fog has already saturated — and above it, it eases the backdrop's
 * lowest degrees into the exact colour the fogged world ends on, so the
 * straight line becomes a grade at every bearing and under every mood,
 * weather tilt and twilight included (they all write `scene.fog`).
 *
 * Self-limiting where the water clears: the band's opacity is the fog's
 * own saturation at its radius, so a wing that thins the water toward
 * glass thins the band with it and nothing prints a wall.
 */

/** The band's radial stand-off: inside the 160 m clip at every bearing. */
const BAND_RADIUS = 150;

/**
 * The alpha profile, in metres relative to the follow height (the
 * camera's): opaque fog from far below eye, easing out by +10 m — about
 * four degrees of altitude at the band's radius, which is the width the
 * painted backdrop's own horizon glow occupies.
 */
const BAND_PROFILE: readonly (readonly [number, number])[] = [
  [-70, 1],
  [-8, 1],
  [-1, 0.72],
  [3.5, 0.28],
  [10, 0],
];

const SEGMENTS = 48;

/** One horizon band, following whatever camera renders it. */
export function buildHorizonFogBand(): Mesh {
  const rows = BAND_PROFILE.length;
  const positions = new Float32Array((SEGMENTS + 1) * rows * 3);
  const colors = new Float32Array((SEGMENTS + 1) * rows * 4);
  const indices: number[] = [];

  for (let row = 0; row < rows; row++) {
    const [y, alpha] = BAND_PROFILE[row]!;
    for (let s = 0; s <= SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      const vertex = row * (SEGMENTS + 1) + s;
      positions[vertex * 3] = Math.cos(a) * BAND_RADIUS;
      positions[vertex * 3 + 1] = y;
      positions[vertex * 3 + 2] = Math.sin(a) * BAND_RADIUS;
      colors[vertex * 4] = 1;
      colors[vertex * 4 + 1] = 1;
      colors[vertex * 4 + 2] = 1;
      colors[vertex * 4 + 3] = alpha;
    }
  }
  for (let row = 0; row < rows - 1; row++) {
    for (let s = 0; s < SEGMENTS; s++) {
      const a = row * (SEGMENTS + 1) + s;
      const b = a + SEGMENTS + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    // The band IS the fog, so it must not be fogged again.
    fog: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    // Viewed from inside only — but the ring triangulation's winding makes
    // the inner surface the FRONT face (the first cut's BackSide culled
    // every fragment and the band painted nothing at all). Double-sided
    // costs nothing at 480 triangles and can never be wrong-way-round.
    side: DoubleSide,
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "horizon-fog-band";
  // Surrounds every camera that can see it; a followed bounding sphere
  // would only ever say yes.
  mesh.frustumCulled = false;
  // AFTER the backdrop layers, BEFORE everything else. The first cut sat
  // at -20 — "behind every other transparent thing" — and painted nothing
  // at all: the band writes no depth, so the distance-sheet classes
  // (DistantReef rings and every region's `*Distance` walls, renderOrder
  // -15…-3, standing at 170–215 m — spatially BEHIND the band's 150 m)
  // drew after it and overwrote it across the whole sky. Order must
  // follow the geometry: backdrop sheets first, this band over them, and
  // the near veils/curtains (order ≥ 0) over it in turn.
  mesh.renderOrder = -2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  mesh.onBeforeRender = (_renderer, scene, camera) => {
    mesh.position.set(camera.position.x, camera.position.y, camera.position.z);
    mesh.updateMatrixWorld();
    const fog = scene.fog;
    if (fog instanceof FogExp2) {
      material.color.copy(fog.color);
      // The fog's own saturation at the band's stand-off. Where a wing
      // clears the water the band clears with it.
      const k = fog.density * BAND_RADIUS;
      material.opacity = 1 - Math.exp(-k * k);
    }
  };

  return mesh;
}
