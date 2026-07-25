import {
  AdditiveBlending,
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type DataTexture,
  type PlaneGeometry,
  type Scene,
} from "three";
import { SEEDS } from "../util/Random";
import { createSeabedGeometry } from "../world/Seabed";
import { buildColorTexture, fbm, voronoi } from "./ProceduralTexture";

/** Edge length of the tiling caustics pattern, in texels. */
const SIZE = 256;

/**
 * How far the caustics reach: full strength within the first radius, gone by
 * the second.
 *
 * Light that has travelled far enough through water to be this fogged has been
 * scattered too much to still focus into filaments, so a web that carries on to
 * the fog line reads as a screen door laid over the whole seabed rather than as
 * sunlight on sand. Ending it early also leaves the far field with nothing but
 * value and colour, which is what makes it read as far.
 */
const REACH_FULL = 14;
const REACH_GONE = 30;

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/**
 * Animated caustics: two tiling sheets of refracted light drifting across the
 * seabed at different rates.
 *
 * The pattern is a Voronoi filament web rather than a scatter of soft blobs.
 * Real caustics are the cell walls of a wavefront focusing on itself — bright
 * thin filaments meeting at nodes — and blobs were the single clearest tell
 * that the light was faked. Two layers cross-drifting makes the light shimmer
 * and interfere instead of visibly sliding in one direction.
 */
export class CausticsSystem {
  readonly mesh: Mesh;

  private readonly layers: {
    material: MeshBasicMaterial;
    texture: DataTexture;
    drift: number;
    weight: number;
  }[] = [];
  private time = 0;

  // `height` must clear the seabed: the overlay is depth tested like anything
  // else, so a sheet at or below the sand never draws. It also has to follow
  // the same dunes, or the crests punch through it.
  constructor(size = 72, height = 0.06) {
    this.mesh = new Mesh(
      bakeReach(createSeabedGeometry(size, 48, height)),
      buildLayerMaterial(SEEDS.caustics, 15),
    );
    this.mesh.renderOrder = 1;
    this.registerLayer(this.mesh, 1);

    // The second sheet sits a hair higher, at a different scale and drift, so
    // the two webs beat against each other.
    const second = new Mesh(
      bakeReach(createSeabedGeometry(size, 48, height + 0.015)),
      buildLayerMaterial(SEEDS.caustics ^ 0x5bd1, 11),
    );
    second.renderOrder = 2;
    this.mesh.add(second);
    // Deliberately fainter than the first. Two webs at equal strength stop
    // reading as interference and start reading as a net laid on the sand.
    this.registerLayer(second, -0.62, 0.5);
  }

  private registerLayer(mesh: Mesh, drift: number, weight = 1): void {
    const material = mesh.material as MeshBasicMaterial;
    this.layers.push({ material, texture: material.map as DataTexture, drift, weight });
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? 0.15 : 1);

    for (const layer of this.layers) {
      layer.texture.offset.set(
        Math.sin(this.time * 0.07 * layer.drift) * 0.12,
        this.time * 0.021 * layer.drift,
      );
      // A touch stronger than when the web was even. The patch mask spends most
      // of the sheet near its floor, so holding the old opacity would have made
      // the caustics uniformly fainter instead of concentrated — the point is
      // to move the light into the patches, not to remove it.
      layer.material.opacity =
        ((reducedMotion ? 0.09 : 0.13) + Math.sin(this.time * 0.5 * layer.drift) * 0.022) *
        layer.weight;
    }
  }
}

/**
 * Writes the radial reach into the sheet's vertex colours. Vertex colours
 * rather than another texture channel because the falloff is in world space,
 * not in the tiling pattern's space — and the sheet already has the vertices to
 * carry it.
 */
function bakeReach(geometry: PlaneGeometry): PlaneGeometry {
  const position = geometry.attributes.position;
  if (!position) {
    return geometry;
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const distance = Math.hypot(position.getX(i), position.getZ(i));
    const reach = 1 - smoothstep01((distance - REACH_FULL) / (REACH_GONE - REACH_FULL));
    colors[i * 3] = reach;
    colors[i * 3 + 1] = reach;
    colors[i * 3 + 2] = reach;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  return geometry;
}

function buildLayerMaterial(seed: number, repeat: number): MeshBasicMaterial {
  const texture = buildColorTexture(SIZE, (u, v) => {
    // Warping the lookup keeps the cells from reading as a regular lattice.
    const warpX = u + (fbm(u, v, { seed: seed ^ 0x11, period: 4, octaves: 3 }) - 0.5) * 0.16;
    const warpY = v + (fbm(u, v, { seed: seed ^ 0x22, period: 4, octaves: 3 }) - 0.5) * 0.16;

    const { f1, f2 } = voronoi(warpX, warpY, 7, seed);
    // f2 - f1 is near zero exactly on a cell boundary, so inverting it gives
    // the bright filament that runs between neighbouring wavefront cells.
    // Kept thin: a thick web stops reading as light and starts reading as a net
    // laid over the sand.
    const edge = 1 - Math.min(1, (f2 - f1) / 0.032);
    const filament = Math.pow(Math.max(0, edge), 2.8);
    // Nodes where several cells meet catch noticeably more light.
    const node = Math.pow(Math.max(0, 1 - f1 / 0.1), 3) * 0.22;

    // Where the wavefront happens to focus, it focuses hard, and between those
    // patches the floor goes nearly unlit. An evenly energetic web is the same
    // mistake as an evenly lit scene: it fills the frame without ever saying
    // where the light is.
    const patch =
      0.35 +
      0.65 *
        smoothstep01(
          (fbm(u, v, { seed: seed ^ 0x77, period: 2, octaves: 2 }) - 0.35) / (0.75 - 0.35),
        );

    const intensity = Math.min(1, filament + node) * patch;
    return [intensity * 0.86, intensity * 1.0, intensity * 0.98];
  });
  texture.repeat.set(repeat, repeat);

  return new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false,
    // The sheet's reach is baked per vertex; without this the web tiles all the
    // way to the fog line.
    vertexColors: true,
    fog: true,
  });
}
