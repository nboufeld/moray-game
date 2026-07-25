import {
  AdditiveBlending,
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
  type DataTexture,
  type Scene,
} from "three";
import { Random, SEEDS } from "../util/Random";
import { seabedHeight } from "../world/Seabed";
import { buildScalarTexture, fbm } from "./ProceduralTexture";

/**
 * A ceiling on grounded light pools, independent of how many beams get authored
 * above. Pools are additive discs lying almost edge-on to the eye, so like the
 * beams themselves their cost is overdraw rather than triangles, and it is
 * worth a hard limit that adding a beam cannot quietly step over.
 */
const MAX_POOLS = 8;

/** How far a pool's disc clears the sand it is painted on. */
const POOL_LIFT = 0.05;

/**
 * Pool radius as a fraction of its shaft's width.
 *
 * Deliberately smaller than the beam. A pool is a horizontal, alpha-blended
 * disc seen from roughly ground level, so its screen footprint is enormous for
 * its size and every one of those fragments is blended whether it contributes
 * anything or not — and under this falloff the outer fifth of the radius
 * contributes about one percent. Measured on the software rasteriser the
 * capture harness uses, eight pools at the beam's full width cost more than the
 * entire rest of the frame; at this radius they are close to free and look the
 * same.
 */
const POOL_SPREAD = 0.7;

/**
 * How far below the sand each beam's quad ends.
 *
 * The beams used to run tens of metres past the seabed, and because they are
 * depth tested that left two crossed quads emerging from the sand along two
 * hard straight lines — a bright X stamped on the floor with none of the
 * softness of the beam above it. Ending each quad just under the surface it
 * lands on puts the ground in the very last stretch of the texture's depth
 * fade, where it is already down to about one percent, so the beam is gone
 * before it can cut anything.
 */
const FOOT_DEPTH = 1.4;

interface ShaftPlacement {
  /**
   * Where the beam meets the sand, in world XZ. Authoring the landing point
   * rather than the beam's midpoint is the whole trick: it is what lets a pool
   * of light sit exactly under each shaft, and it means a shaft can be aimed at
   * something instead of scattered and hoped over.
   */
  readonly ground: readonly [number, number];
  readonly width: number;
  /**
   * Height of the beam's midpoint above the sand it lands on. Its length falls
   * out of this and `FOOT_DEPTH` rather than being authored separately — the
   * two cannot disagree, and a beam that reaches its landing point is the only
   * kind that can have a pool under it.
   */
  readonly height: number;
  /** Distant beams are half strength: they are depth cues, not staging. */
  readonly faint?: boolean;
}

/**
 * Eight beams, placed rather than scattered.
 *
 * Three cross the corridor the diver swims down, so the opening minutes always
 * have light falling somewhere they are looking; the first lands just behind
 * the hero moray's crevice at (0, 1.4, 1.5), which is what puts atmosphere
 * behind the subject in the close-up. The other five sit past fifteen metres at
 * half strength, where their job is to describe how far away the far water is.
 */
const PLACEMENTS: readonly ShaftPlacement[] = [
  { ground: [0.5, -0.9], width: 4.0, height: 5.6 },
  { ground: [-4.5, 6.0], width: 5.6, height: 6.4 },
  { ground: [5.5, 8.5], width: 4.4, height: 5.0 },
  { ground: [-16.5, 5.0], width: 5.0, height: 6.0, faint: true },
  { ground: [15.5, -7.0], width: 6.2, height: 6.8, faint: true },
  { ground: [-8.0, -16.0], width: 5.4, height: 6.2, faint: true },
  // Kept out on the flank deliberately. Moved in near the spawn point to give
  // the opening shot a closer highlight, this beam put its curtain a few metres
  // from the camera, and a full-screen additive layer that close does not read
  // as a shaft at all — it is a veil over the whole frame that lifts the blacks
  // everywhere and gains no highlight worth having.
  { ground: [11.0, 15.0], width: 6.8, height: 7.0, faint: true },
  { ground: [-13.0, -13.5], width: 5.8, height: 6.4, faint: true },
];

interface Beam {
  readonly shaft: MeshBasicMaterial;
  readonly pool: MeshBasicMaterial | null;
  readonly phase: number;
  /** Half for the distant beams, so one number dims a shaft and its pool alike. */
  readonly strength: number;
}

/**
 * Sunlight raking down through the surface, faked with crossed additive
 * curtains rather than volumetrics.
 *
 * Each shaft is two quads in a cross so it never disappears when the diver
 * happens to view it edge-on, and every shaft is depth tested, so the rocks and
 * coral cut into the beams the way they should.
 *
 * Each also lands on something. A beam that passes through the water and leaves
 * the sand beneath it exactly as bright as the sand beside it is not light, it
 * is a decal — the pool is what makes the shaft read as illumination and gives
 * the frame the one genuinely bright note it needs at the top of its range.
 */
export class LightShafts {
  readonly group = new Group();

  // One material per shaft. They are cheap, and a single shared opacity made
  // the entire ocean breathe on one metronome.
  private readonly beams: Beam[] = [];
  private readonly baseOpacity = 0.26;
  // Tuned against the closest pool a canonical camera ever stands over, not the
  // average one: at 0.7 the mid-depth traverse shot showed a pure white hole in
  // its foreground — no shape, no falloff, just clip — and the bloom smeared it
  // into a cross rather than a glow.
  private readonly poolOpacity = 0.45;
  private time = 0;

  constructor(sunDirection: Vector3, seed: number = SEEDS.shafts) {
    const random = new Random(seed);

    const texture = createShaftTexture();
    const poolTexture = createPoolTexture();

    // Point each shaft down the sun ray: the geometry runs along its own +Y.
    const along = sunDirection.clone().normalize().negate();
    const orientation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along);
    // Walking back up the ray from the landing point by this much per metre of
    // height is what keeps a pool under its shaft however the sun is angled.
    const perMetre = 1 / -along.y;

    for (const placement of PLACEMENTS) {
      const [groundX, groundZ] = placement.ground;
      const strength = placement.faint === true ? 0.5 : 1;
      const phase = random.range(0, Math.PI * 2);

      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: this.baseOpacity * strength,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        // Fog would tint an additive surface and brighten the distance instead
        // of fading it, so the shafts opt out and rely on their own falloff.
        fog: false,
      });

      const shaft = new Group();
      shaft.quaternion.copy(orientation);
      const back = placement.height * perMetre;
      shaft.position.set(
        groundX - along.x * back,
        seabedHeight(groundX, groundZ) + placement.height,
        groundZ - along.z * back,
      );

      const length = 2 * (placement.height + FOOT_DEPTH) * perMetre;
      for (const spin of [0, Math.PI / 2]) {
        const geometry = new PlaneGeometry(placement.width, length);
        const blade = new Mesh(geometry, material);
        blade.rotation.y = spin + random.signed(0.4);
        blade.renderOrder = 2;
        shaft.add(blade);
      }
      this.group.add(shaft);

      const pool =
        this.beams.length < MAX_POOLS
          ? this.addPool(groundX, groundZ, placement.width * POOL_SPREAD, poolTexture, strength, random)
          : null;

      this.beams.push({ shaft: material, pool, phase, strength });
    }
  }

  private addPool(
    x: number,
    z: number,
    radius: number,
    map: DataTexture,
    strength: number,
    random: Random,
  ): MeshBasicMaterial {
    // A ring rather than a fan: a disc this wide has to follow the dunes across
    // its whole span, and a single centre vertex cannot describe a crest.
    const geometry = new RingGeometry(0, radius, 24, 3);
    geometry.rotateX(-Math.PI / 2);
    // Every pool shares one texture, so without a spin per pool the same lumpy
    // outline appears eight times over and the eye finds it immediately. It has
    // to be baked into the geometry rather than set on the mesh: the dune
    // heights below are sampled per vertex, and turning the mesh afterwards
    // would slide those samples off the sand they were measured from.
    geometry.rotateY(random.range(0, Math.PI * 2));

    const position = geometry.attributes.position;
    if (position) {
      for (let i = 0; i < position.count; i++) {
        position.setY(i, seabedHeight(x + position.getX(i), z + position.getZ(i)) + POOL_LIFT);
      }
      position.needsUpdate = true;
    }

    const material = new MeshBasicMaterial({
      map,
      color: 0xd2eeff,
      transparent: true,
      opacity: this.poolOpacity * strength,
      blending: AdditiveBlending,
      depthWrite: false,
      // Unlike the shafts, a pool is brighter than the fog it fades into, so
      // fog dims the distant ones rather than lifting them.
      fog: true,
    });

    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, 0, z);
    mesh.renderOrder = 1;
    this.group.add(mesh);

    return material;
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? 0.25 : 1);
    // A slow breathing pulse; the surface above is never quite still. Each
    // shaft runs on its own phase so the swell reads as water, not a dimmer.
    const calm = reducedMotion ? 0.75 : 1;
    for (const beam of this.beams) {
      const pulse = 1 + Math.sin(this.time * 0.35 + beam.phase) * 0.28;
      beam.shaft.opacity = this.baseOpacity * calm * beam.strength * pulse;
      if (beam.pool) {
        // Same phase as its shaft: a pool that brightens while its beam dims
        // immediately stops looking like the beam is what lit it.
        beam.pool.opacity = this.poolOpacity * calm * beam.strength * pulse;
      }
    }
  }
}

/**
 * A soft-edged beam: a bell across the width so the sides never show a hard
 * boundary, fading out along its length as the light is absorbed.
 */
function createShaftTexture(): CanvasTexture {
  const width = 64;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      // Canvas y = 0 is the top of the plane, nearest the surface.
      const depth = 1 - y / (height - 1);
      // Ramp in just under the surface as well as out with depth: without the
      // head fade the quad's top edge cuts a hard diagonal across the water.
      const head = Math.min(1, (1 - depth) * 7);
      const fade = Math.pow(depth, 1.7) * head;
      for (let x = 0; x < width; x++) {
        const across = (x / (width - 1)) * 2 - 1;
        const bell = Math.pow(Math.cos((across * Math.PI) / 2), 2.2);
        const alpha = Math.max(0, bell * fade);
        const index = (y * width + x) * 4;
        image.data[index] = 214;
        image.data[index + 1] = 245;
        image.data[index + 2] = 255;
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The pool a shaft casts on the sand: a hot centre falling away to nothing well
 * inside the disc, so the geometry's rim never shows.
 */
function createPoolTexture(): DataTexture {
  const texture = buildScalarTexture(128, (u, v) => {
    // Break the outline before measuring it. A pool whose edge is a circle is
    // read as a circle however soft it is, and a painted disc on the sand is
    // worse than no pool at all — so the radius wobbles, and the interior is
    // modulated by the same kind of noise, which is also what light arriving
    // through a moving surface actually looks like where it lands.
    const wobble = fbm(u, v, { seed: SEEDS.shafts ^ 0x3d, period: 3, octaves: 3 });
    const distance = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2 * (0.84 + 0.34 * wobble));

    // A broad, soft brightening carrying a much smaller hot centre. The halo
    // alone reads as a grey disc laid on the sand; the core alone reads as a
    // spotlight. Together they read as light, and only the core is bright
    // enough to bloom, which keeps the glow the size of a highlight rather than
    // the size of the disc.
    const halo = Math.pow(1 - distance * distance, 2.8);
    const core = Math.pow(Math.max(0, 1 - distance * 2.4), 2);
    // Grain rides the halo and leaves the core alone: the core is the part that
    // has to clear the bloom threshold, and noise that happened to land low on
    // it would quietly cost the frame its only highlight.
    const grain = 0.55 + 0.5 * fbm(u, v, { seed: SEEDS.shafts ^ 0x5c, period: 6, octaves: 3 });

    // Weighted toward the core. Seen from a metre or two away a pool covers a
    // great deal of screen, and additive light spread evenly over that much
    // sand does not brighten the sand so much as erase it — the grains, the
    // ripples and the dune shading all vanish under a flat wash. Keeping the
    // bright part small leaves the sand legible everywhere except the few
    // square metres that are genuinely blown out.
    return Math.min(1, 0.52 * core + 0.48 * halo * grain);
  });
  // Repeat wrapping would let the rim sample across to the opposite edge.
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  // No anisotropy. These discs lie flat and are viewed from near ground level,
  // so they are exactly the case anisotropic filtering is expensive for — and
  // there is nothing here for it to resolve but a smooth radial ramp.
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  return texture;
}
