import {
  AdditiveBlending,
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type PlaneGeometry,
  type Scene,
  type Texture,
} from "three";
import { SEEDS } from "../util/Random";
import { createSeabedGeometry } from "../world/Seabed";
import { requestAlbedo } from "./AssetLibrary";
import { buildColorTexture, fbm, voronoi } from "./ProceduralTexture";
import type { WeatherMoods } from "./WeatherMoods";

/** Edge length of the tiling caustics pattern, in texels. */
const SIZE = 256;

/**
 * How much sand one repeat of a layer covers, in metres.
 *
 * A dapple is authored as a physical size — a bit over a metre across for the
 * near layer, half again for the far one — so the repeat has to be derived
 * from the sheet's extent rather than fixed. The reef's sheet is 72m and the
 * sanctuary's is 40m, and at a fixed repeat the same pattern came out nearly
 * half the size in the smaller room.
 *
 * 7 and 11 since W-O3, from 5.5 and 8. The round critic's overhead pose read
 * the dapples as "polka dots", and from twelve metres up that is what a
 * sub-metre blob on a 5.5-metre lattice is: at that distance a dapple is a
 * dozen pixels, too small to show its soft rim, and thirteen repeats of one
 * tile fit inside the frame with their spacing legible. Larger tiles enlarge
 * every blob *and its falloff* together (the painting scales as one), and
 * they widen the two layers' scale ratio from 1.45 to 1.57, so the beat
 * between the sheets repeats less often inside a frame. Energy is untouched:
 * the same image at a larger repeat covers the same fraction of sand, so the
 * opacity note below still means what it says.
 */
const TILE_METRES = [7, 11] as const;

/**
 * How far each layer's pattern is turned, in radians about the tile centre.
 *
 * Both layers wear clones of the *same* painted sheet, and axis-aligned they
 * are one lattice at two scales — from overhead their repeats line up along
 * the world axes and the eye finds the grid immediately. Turning the far
 * layer breaks the shared axes without touching the pattern; a seamless tile
 * rotated is still seamless. The generated fallback layers are two different
 * seeds and never aligned, so only the painted swap applies these.
 */
const LAYER_SPIN = [0, 1.07] as const;

/** Feature points per tile. With the tiles above, one cell is under 1.5 m. */
const CELLS = 5;

/**
 * The dapple's edge, as a fraction of a cell: opaque within the inner radius,
 * gone by the outer one.
 *
 * The feather is most of the blob on purpose. A disc with a crisp edge is a
 * decal however round it is; a disc that is mostly falloff is a brush loaded
 * with light, which is what a Ponyo seabed is painted with.
 */
const DAPPLE_CORE = 0.12;
const DAPPLE_EDGE = 0.42;

/**
 * How far the caustics reach: full strength within the first radius, gone by
 * the second. Measured from the world origin, not from the diver — the sheet
 * is a fixture, and one that slid about under the camera would be the most
 * obvious artifact in the game.
 *
 * It ended at 14m while the pattern was a filament web, on the argument that
 * light scattered enough to be this fogged cannot still focus into filaments.
 * That argument does not survive the dapples: a soft round blob is precisely
 * what scattered light leaves, and the reason to stop early has gone with the
 * web. What made the old radius indefensible is where the opening camera
 * stands — 22m out at the reef's edge, so the whole foreground of the game's
 * first frame sat outside the reach and its largest surface was bare sand.
 * The fog closes the far field long before the mesh's own rim at 36m.
 */
const REACH_FULL = 22;
const REACH_GONE = 34;

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/**
 * Animated caustics: two tiling sheets of refracted light drifting across the
 * seabed at different rates.
 *
 * The pattern is a scatter of soft round dapples — painted ones where the
 * asset is on disk, and the generated ones below where it is not — and that is
 * a deliberate reversal. A Voronoi filament web is what a photograph of a reef
 * floor holds —
 * the cell walls of a wavefront focusing on itself, bright thin filaments
 * meeting at nodes — and rendered at this scale it reads as a net laid over the
 * sand. A picture book paints the same light as a handful of round blobs of
 * warm white, and the eye reads those as sunlight through water without ever
 * having been shown a filament. The two cross-drifting layers stay: they are
 * what makes the light shimmer rather than visibly slide one way.
 */
export class CausticsSystem {
  readonly mesh: Mesh;

  private readonly layers: {
    material: MeshBasicMaterial;
    texture: Texture;
    repeat: number;
    spin: number;
    drift: number;
    weight: number;
  }[] = [];
  private time = 0;
  /** The sky's slow moods (W-M1); null — and identity — everywhere but the reef. */
  private weather: WeatherMoods | null = null;
  /** Whether a mood has written the tints, so identity restores them once. */
  private tinted = false;

  // `height` must clear the seabed: the overlay is depth tested like anything
  // else, so a sheet at or below the sand never draws. It also has to follow
  // the same dunes, or the crests punch through it.
  constructor(size = 72, height = 0.06) {
    this.mesh = new Mesh(
      bakeReach(createSeabedGeometry(size, 48, height)),
      buildLayerMaterial(SEEDS.caustics, repeatFor(size, TILE_METRES[0])),
    );
    this.mesh.renderOrder = 1;
    this.registerLayer(this.mesh, repeatFor(size, TILE_METRES[0]), LAYER_SPIN[0], 1);

    // The second sheet sits a hair higher, with larger dapples and its own
    // drift, so the two scatters beat against each other.
    const second = new Mesh(
      bakeReach(createSeabedGeometry(size, 48, height + 0.015)),
      buildLayerMaterial(SEEDS.caustics ^ 0x5bd1, repeatFor(size, TILE_METRES[1])),
    );
    second.renderOrder = 2;
    this.mesh.add(second);
    // Deliberately fainter than the first. Two scatters at equal strength stop
    // reading as one light shimmering and start reading as twice as many spots.
    this.registerLayer(second, repeatFor(size, TILE_METRES[1]), LAYER_SPIN[1], -0.62, 0.5);

    this.requestPaintedDapples();
  }

  private registerLayer(mesh: Mesh, repeat: number, spin: number, drift: number, weight = 1): void {
    const material = mesh.material as MeshBasicMaterial;
    this.layers.push({ material, texture: material.map as Texture, repeat, spin, drift, weight });
  }

  /**
   * Swaps in the painted dapples, keeping the generated ones until they land.
   *
   * Each layer takes its own `clone()` of the one loaded texture, and that is
   * not a copy: clones share a `Source`, so this is still one image and one
   * upload. What they need their own of is the `offset` — the two sheets drift
   * across each other at different rates, and a shared texture would slide them
   * together and turn the beat into a single pattern moving.
   *
   * The generated map each layer was wearing is disposed, because a layer owns
   * its procedural texture. The painted one is *not* ever disposed: the asset
   * library owns it, hands the same object to every caller, and disposing a
   * clone would take the shared source down with it.
   */
  private requestPaintedDapples(): void {
    requestAlbedo(
      "world/caustic-dapple.png",
      (texture) => {
        for (const layer of this.layers) {
          const painted = texture.clone();
          painted.repeat.set(layer.repeat, layer.repeat);
          // See LAYER_SPIN: the two clones are one image, so the far layer is
          // turned off the near one's axes. Centre first, or the rotation
          // pivots about the tile corner and shears the drift.
          painted.center.set(0.5, 0.5);
          painted.rotation = layer.spin;
          layer.material.map = painted;
          layer.material.needsUpdate = true;
          layer.texture.dispose();
          layer.texture = painted;
        }
      },
      { tile: true },
    );
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  /** Opts the dapples into the sky's slow moods (W-M1). Only the reef attaches. */
  attachWeather(weather: WeatherMoods): void {
    this.weather = weather;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? 0.15 : 1);
    // W-M1: one gain over both layers — an overcast dims the dapples, a
    // golden hour warms them up a step. A trailing × 1 at identity is exact.
    // W-N4: the dapples also wear the mood's *shaft* tint — a dapple is where
    // a beam lands, so the beam, its pool and its dapple are one light and
    // take one colour; splitting them would let a golden hour pour amber
    // beams onto neutral dapples. And a gain of exactly 0 (a full overcast)
    // hides the sheets outright: a zero-opacity additive layer over the whole
    // seabed still pays its fill. The tint and visibility are written only
    // while a mood is on and restored once, like the shafts' own.
    const weather =
      this.weather !== null && !this.weather.isIdentity ? this.weather.channels : null;
    const gain = weather === null ? 1 : weather.caustics;
    const hidden = weather !== null && gain === 0;
    if (weather !== null) {
      for (const layer of this.layers) {
        layer.material.color.setRGB(weather.shaftRed, weather.shaftGreen, weather.shaftBlue);
        layer.material.visible = !hidden;
      }
      this.tinted = true;
    } else if (this.tinted) {
      this.tinted = false;
      for (const layer of this.layers) {
        layer.material.color.setRGB(1, 1, 1);
        layer.material.visible = true;
      }
    }

    for (const layer of this.layers) {
      layer.texture.offset.set(
        Math.sin(this.time * 0.07 * layer.drift) * 0.12,
        this.time * 0.021 * layer.drift,
      );
      // Measured rather than judged, twice. At the 0.16 this started WP-G4 at,
      // the generated dapples moved the sand by four parts in 255 at their own
      // median and eleven at their p90, against a frame sitting at 137 —
      // present in the pixels and invisible in the picture — so they went to
      // 0.26. The painted ones are a far stronger mark at the same opacity:
      // measured against the generated sheet through `probe-light.mjs`, they
      // cover slightly *less* of the frame (23% against 25% in shot A) and hit
      // two and a half times harder at the p90, 58 against 23, because the
      // painting spends its light on a few big bright cores instead of spreading
      // it. Left there they lifted the opening shot's median by eleven parts,
      // which is the seabed going pale. Two thirds of the way back holds the
      // median where the generated sheet had it and keeps the cores.
      layer.material.opacity =
        ((reducedMotion ? 0.12 : 0.17) + Math.sin(this.time * 0.5 * layer.drift) * 0.02) *
        layer.weight *
        gain;
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

/** Whole repeats of a `metres`-wide tile across a sheet `size` metres across. */
function repeatFor(size: number, metres: number): number {
  // Whole, because a fractional repeat wraps mid-tile at the sheet's rim.
  return Math.max(1, Math.round(size / metres));
}

function buildLayerMaterial(seed: number, repeat: number): MeshBasicMaterial {
  const texture = buildColorTexture(SIZE, (u, v) => {
    // Warping the lookup keeps the cells from reading as a regular lattice.
    const warpX = u + (fbm(u, v, { seed: seed ^ 0x11, period: 4, octaves: 3 }) - 0.5) * 0.16;
    const warpY = v + (fbm(u, v, { seed: seed ^ 0x22, period: 4, octaves: 3 }) - 0.5) * 0.16;

    // Only f1 is read: the distance to the nearest feature point is a round
    // blob around it, where the f2 - f1 the filaments were built from is the
    // wall between two of them.
    const { f1 } = voronoi(warpX, warpY, CELLS, seed);
    // Thresholding f1 alone would give every dapple the same radius, which is
    // a polka dot. Scaling the distance by low-frequency noise varies each
    // blob's size and puts a slow wobble in its rim — the two things that
    // separate a painted blob from a stamped circle. The swing widened from
    // ±22% to ±38% in W-O3, when the overhead pose showed the fallback's
    // blobs still reading as one population at one size; the mean stays 1, so
    // the sheet's energy does not move with it.
    const wobble = 0.62 + 0.76 * fbm(u, v, { seed: seed ^ 0x33, period: 3, octaves: 2 });
    const dapple = smoothstep01(
      (DAPPLE_EDGE - f1 * CELLS * wobble) / (DAPPLE_EDGE - DAPPLE_CORE),
    );

    // Where the surface happens to focus, it focuses hard, and between those
    // patches the floor goes nearly unlit. An evenly energetic sheet is the
    // same mistake as an evenly lit scene: it fills the frame without ever
    // saying where the light is.
    const patch =
      0.5 +
      0.5 *
        smoothstep01(
          (fbm(u, v, { seed: seed ^ 0x77, period: 2, octaves: 2 }) - 0.35) / (0.75 - 0.35),
        );

    // Warm white, and further from white than it looks: sand is already a warm
    // surface, so its blue channel sits low and its red high, and adding light
    // in that same proportion moves blue further *in sRGB* than it moves red.
    // Measured on the composited frame a (1.0, 0.98, 0.88) dapple came out
    // neutral to within half a part in 255. Pulling blue down to four fifths is
    // what buys back the warmth the eye is supposed to see.
    const intensity = dapple * patch;
    return [intensity * 1.0, intensity * 0.96, intensity * 0.8];
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
