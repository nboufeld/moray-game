import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  type DataTexture,
  type Scene,
} from "three";
import { SEEDS } from "../util/Random";
import { createSeabedGeometry } from "../world/Seabed";
import { buildColorTexture, fbm, voronoi } from "./ProceduralTexture";

/** Edge length of the tiling caustics pattern, in texels. */
const SIZE = 256;

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
    this.mesh = new Mesh(createSeabedGeometry(size, 48, height), buildLayerMaterial(SEEDS.caustics, 15));
    this.mesh.renderOrder = 1;
    this.registerLayer(this.mesh, 1);

    // The second sheet sits a hair higher, at a different scale and drift, so
    // the two webs beat against each other.
    const second = new Mesh(
      createSeabedGeometry(size, 48, height + 0.015),
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
      layer.material.opacity =
        ((reducedMotion ? 0.07 : 0.1) + Math.sin(this.time * 0.5 * layer.drift) * 0.022) *
        layer.weight;
    }
  }
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

    const intensity = Math.min(1, filament + node);
    return [intensity * 0.86, intensity * 1.0, intensity * 0.98];
  });
  texture.repeat.set(repeat, repeat);

  return new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
}
