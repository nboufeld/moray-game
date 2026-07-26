import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  Group,
  Matrix4,
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
 * lands on keeps that cut short.
 *
 * Short, but not gone: the quad is tilted forty degrees off vertical along the
 * sun ray, so its width axis is tilted too, and a plane like that does not meet
 * the flat sand along a line of constant height up the beam — it meets it along
 * a diagonal that climbs a metre and a half from one side of the beam to the
 * other. Ending the quad under the sand cannot help the far corner of that
 * diagonal, which is why the fade below is measured against the seabed itself.
 */
const FOOT_DEPTH = 1.4;

/**
 * The stretch above the sand over which a beam fades out, in metres, and the
 * dead band under it that guarantees the fade has reached zero by the time the
 * quad reaches the ground.
 *
 * This is the whole of the fix for the bright wedges the beams used to stamp on
 * the seabed. A curtain that is still lit where it enters the sand ends on a
 * straight line — the depth test gives it one, exactly along the diagonal
 * above — and no amount of softness in the texture matters, because the cut is
 * geometric. Fading against `seabedHeight` instead of against the texture's own
 * axis follows the dunes as well as the tilt, and it leaves everything above
 * knee height on the beams exactly as it was tuned: the shafts still carry
 * their brightest stretch low down, and their landing is the pool's job.
 */
const GROUND_FADE_START = 0.15;
const GROUND_FADE_END = 1.8;

/**
 * Segments per blade. Four vertices cannot carry a fade that runs diagonally
 * across the quad, and the fade has to be resolved finely enough that the
 * interpolation between two rings is still near zero where the sand cuts
 * through. These are triangles, not fragments; the beams' cost is overdraw and
 * that is untouched.
 */
const BLADE_SPAN_SEGMENTS = 6;
const BLADE_LENGTH_SEGMENTS = 40;

/**
 * Tessellation of a pool's disc.
 *
 * The disc is fitted to `seabedHeight` vertex by vertex, so its segment count
 * is how faithfully it follows the dunes: at the previous three rings and
 * twenty-four spokes a four-metre pool spanned the sand in metre-and-a-half
 * chords, and every place where a chord cut a dune — or ran into the sand it
 * was lying on — showed as a straight line drawn across the seabed in light.
 * At these counts the longest chord is under half a metre, finer than the
 * seabed's own 0.94m grid, so the disc rides the sand instead of chording
 * across it. Triangles are not what these cost; overdraw is, and that is
 * unchanged.
 */
const POOL_SPOKES = 48;
const POOL_RINGS = 10;

/**
 * Where the disc's own rim fade begins, as a fraction of its radius.
 *
 * The texture already falls to nothing before its edge, but a pool is a huge,
 * near-horizontal surface seen from close to ground level, which is the worst
 * case for minification: the mip level the rim samples at is coarse enough to
 * average the map into a flat wash, and a flat wash right up to the last
 * triangle is a bright polygon with a hard outline — the "decal" reading. A
 * fade baked into the vertices cannot be filtered away, so it holds the rim at
 * zero however far the texture has blurred. It starts well outside the core so
 * the brightness the pools were tuned for is untouched.
 */
const POOL_RIM_FADE = 0.55;

/**
 * The window applied to the pool map so its falloff reaches zero inside the
 * disc's rim rather than at it. Without the outer bound the wobble can leave
 * the outermost texels lit, and those texels are exactly the geometry's edge.
 */
const POOL_TEXTURE_FADE_IN = 0.72;
const POOL_TEXTURE_FADE_OUT = 0.95;

/**
 * How close to edge-on a shaft blade may get before it is faded out.
 *
 * A shaft is two crossed quads, which is what keeps it from vanishing when the
 * diver views one of them along its plane. What that leaves behind is worse
 * than vanishing: the edge-on quad still rasterises, as a one-pixel line of
 * concentrated additive light drawn across the frame with none of the softness
 * its texture gives it anywhere else. The blade contributes nothing at that
 * angle anyway — it has no width on screen — so it is faded out before it can
 * become a hairline, and its partner, ninety degrees away, carries the shaft.
 */
const EDGE_ON_FADE_IN = 0.06;
const EDGE_ON_FADE_OUT = 0.3;

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface ShaftPlacement {
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
 * Six beams, placed rather than scattered.
 *
 * Three cross the corridor the diver swims down, so the opening minutes always
 * have light falling somewhere they are looking; the first lands just behind
 * the hero moray's crevice at (0, 1.4, 1.5), which is what puts atmosphere
 * behind the subject in the close-up. The other three sit past fifteen metres
 * at half strength, where their job is to describe how far away the far water
 * is.
 *
 * It was eight until WP-G4, and the three staged beams went up by three fifths
 * in width in the same pass, so the light in the water is not far off what it
 * was — there are simply fewer, broader things carrying it. A painted ribbon of
 * light is a compositional element and a frame can hold two or three of them;
 * eight narrow ones are weather.
 *
 * The distant three took a fifth rather than three fifths, and that asymmetry
 * was measured. A beam's screen width is its width over its distance, and these
 * were already authored wide to survive being far away — widened to match the
 * near ones they stopped being beams at all: the mid-depth traverse came back
 * with a curtain across 99% of its frame, its tenth percentile lifted eight
 * parts in 255 and its red mean twenty. That is the veil this list has warned
 * about since the beam at (11, 15) was moved out, arriving from the other
 * direction.
 *
 * Of the two that went, one was the deep-left flanker's twin — a pair of beams
 * five metres apart at that distance is one beam with a seam in it once they
 * are this wide — and the other stood at (11, 15), seven metres off the spawn
 * point. That one had already been moved out to the flank once, for a reason
 * widening it only sharpens: a curtain that close does not read as a shaft at
 * all, it is a veil over the whole frame that lifts the blacks everywhere and
 * gains no highlight worth having. Do not put a beam near the spawn point.
 */
const PLACEMENTS: readonly ShaftPlacement[] = [
  { ground: [0.5, -0.9], width: 6.4, height: 5.6 },
  { ground: [-4.5, 6.0], width: 9.0, height: 6.4 },
  // Widened least of the three staged beams, because the mid-depth traverse
  // camera stands six metres from it: a curtain that close fills sixty degrees
  // of frame at the full retune, and 99% of that shot's pixels came back
  // touched by a shaft. Screen width is width over distance, and this is the
  // one beam a canonical camera walks up to.
  { ground: [5.5, 8.5], width: 5.6, height: 5.0 },
  { ground: [-16.5, 5.0], width: 6.0, height: 6.0, faint: true },
  { ground: [15.5, -7.0], width: 7.4, height: 6.8, faint: true },
  { ground: [-8.0, -16.0], width: 6.5, height: 6.2, faint: true },
];

interface Blade {
  /**
   * One material per quad rather than one per shaft: the edge-on fade is a
   * property of a single plane, and two quads sharing a material can only fade
   * together — which would take the whole shaft out at the exact angle where
   * its other half is the one being looked at. Materials are cheap and the
   * mesh count, which is what the draw calls are, does not change.
   */
  readonly material: MeshBasicMaterial;
  /** World-space normal of the quad's plane. Nothing here ever moves. */
  readonly normal: Vector3;
}

interface Beam {
  readonly blades: readonly Blade[];
  /**
   * A point on both blades' planes, so the dot product below measures how far
   * the camera sits off a plane rather than where it sits along one.
   */
  readonly center: Vector3;
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
 * happens to view it edge-on — the quad being looked along fades out and its
 * partner carries the beam — and every shaft is depth tested, so the rocks and
 * coral cut into the beams the way they should. What the depth test must not be
 * allowed to cut is the sand itself, which is what the ground fade is for.
 *
 * Each also lands on something. A beam that passes through the water and leaves
 * the sand beneath it exactly as bright as the sand beside it is not light, it
 * is a decal — the pool is what makes the shaft read as illumination and gives
 * the frame the one genuinely bright note it needs at the top of its range.
 */
export class LightShafts {
  readonly group = new Group();

  // A material per quad, never one shared across beams: a single opacity made
  // the entire ocean breathe on one metronome.
  private readonly beams: Beam[] = [];
  // Down a third from 0.26 to pay for WP-G4's wider, softer beams: three
  // fifths more width and a flatter bell is close to twice the light per beam,
  // and two fewer beams gives back rather less than that. The warm tint costs
  // more than the arithmetic says, too — this water has very little red in it,
  // so a warm additive is far more visible than the same luminance of a cool
  // one, which is the same reading-the-red-channel-first rule the value key
  // rests on.
  private readonly baseOpacity = 0.17;
  // Tuned against the closest pool a canonical camera ever stands over, not the
  // average one: at 0.7 the mid-depth traverse shot showed a pure white hole in
  // its foreground — no shape, no falloff, just clip — and the bloom smeared it
  // into a cross rather than a glow.
  private readonly poolOpacity = 0.45;
  private readonly viewScratch = new Vector3();
  private time = 0;

  /**
   * `placements` defaults to the reef's authored beams. The sanctuary lights
   * its own room with the same machinery and its own landing points; the reef's
   * are the default so that a second set of beams cannot move the first.
   */
  constructor(
    sunDirection: Vector3,
    seed: number = SEEDS.shafts,
    placements: readonly ShaftPlacement[] = PLACEMENTS,
  ) {
    const random = new Random(seed);

    const texture = shaftMap();
    const poolTexture = poolMap();

    // Point each shaft down the sun ray: the geometry runs along its own +Y.
    const along = sunDirection.clone().normalize().negate();
    const orientation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along);
    // Walking back up the ray from the landing point by this much per metre of
    // height is what keeps a pool under its shaft however the sun is angled.
    const perMetre = 1 / -along.y;

    for (const placement of placements) {
      const [groundX, groundZ] = placement.ground;
      const strength = placement.faint === true ? 0.5 : 1;
      const phase = random.range(0, Math.PI * 2);

      const shaft = new Group();
      shaft.quaternion.copy(orientation);
      const back = placement.height * perMetre;
      shaft.position.set(
        groundX - along.x * back,
        seabedHeight(groundX, groundZ) + placement.height,
        groundZ - along.z * back,
      );

      // Resolve the shaft's own transform up front: the blades bake a fade
      // against the sand and need their world placement to do it. The group
      // this hangs off never moves, so what is computed here is final.
      shaft.updateMatrixWorld(true);

      const length = 2 * (placement.height + FOOT_DEPTH) * perMetre;
      const blades: Blade[] = [];
      for (const spin of [0, Math.PI / 2]) {
        const material = new MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: this.baseOpacity * strength,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
          // Carries the fade into the sand, baked per vertex below.
          vertexColors: true,
          // Fog would tint an additive surface and brighten the distance
          // instead of fading it, so the shafts opt out and rely on their own
          // falloff.
          fog: false,
        });

        const geometry = new PlaneGeometry(
          placement.width,
          length,
          BLADE_SPAN_SEGMENTS,
          BLADE_LENGTH_SEGMENTS,
        );
        const blade = new Mesh(geometry, material);
        const turn = spin + random.signed(0.4);
        blade.rotation.y = turn;
        blade.renderOrder = 2;
        shaft.add(blade);
        // The fade is measured in world space, so the blade has to know where
        // it ended up. Nothing here moves afterwards.
        blade.updateMatrixWorld(true);
        bakeGroundFade(geometry, blade.matrixWorld);

        // The quad's own normal is +Z; the turn about Y and the shaft's tilt
        // down the sun ray are the whole of its world orientation.
        blades.push({
          material,
          normal: new Vector3(Math.sin(turn), 0, Math.cos(turn)).applyQuaternion(orientation),
        });
      }
      this.group.add(shaft);

      const pool =
        this.beams.length < MAX_POOLS
          ? this.addPool(groundX, groundZ, placement.width * POOL_SPREAD, poolTexture, strength, random)
          : null;

      this.beams.push({ blades, center: shaft.position.clone(), pool, phase, strength });
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
    const geometry = new RingGeometry(0, radius, POOL_SPOKES, POOL_RINGS);
    geometry.rotateX(-Math.PI / 2);
    // Every pool shares one texture, so without a spin per pool the same lumpy
    // outline appears eight times over and the eye finds it immediately. It has
    // to be baked into the geometry rather than set on the mesh: the dune
    // heights below are sampled per vertex, and turning the mesh afterwards
    // would slide those samples off the sand they were measured from.
    geometry.rotateY(random.range(0, Math.PI * 2));

    const position = geometry.attributes.position;
    if (position) {
      const fade = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const localX = position.getX(i);
        const localZ = position.getZ(i);
        position.setY(i, seabedHeight(x + localX, z + localZ) + POOL_LIFT);

        // Rotation preserves radius, so the spin baked in above leaves this
        // alone — as does any mip level the rim ends up sampling at.
        const edge = 1 - smoothStep(POOL_RIM_FADE, 1, Math.hypot(localX, localZ) / radius);
        fade[i * 3] = edge;
        fade[i * 3 + 1] = edge;
        fade[i * 3 + 2] = edge;
      }
      position.needsUpdate = true;
      geometry.setAttribute("color", new BufferAttribute(fade, 3));
    }

    const material = new MeshBasicMaterial({
      map,
      // The same warm white the beam above it is painted in. A cool pool under
      // a warm ribbon is two light sources, and the sand it lands on says which
      // one is lying.
      color: 0xffefd6,
      // Multiplies the map, and carries the rim fade the filtering cannot
      // reach.
      vertexColors: true,
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

  /**
   * `cameraPosition` is optional so that a caller with no camera to hand — the
   * unit tests, and anything driving the shafts before a frame has been posed —
   * still gets the beams it had before. Given one, each quad is faded as it
   * turns edge-on to it.
   */
  update(dt: number, reducedMotion: boolean, cameraPosition?: Vector3): void {
    this.time += dt * (reducedMotion ? 0.25 : 1);
    // A slow breathing pulse; the surface above is never quite still. Each
    // shaft runs on its own phase so the swell reads as water, not a dimmer.
    const calm = reducedMotion ? 0.75 : 1;
    for (const beam of this.beams) {
      const pulse = 1 + Math.sin(this.time * 0.35 + beam.phase) * 0.28;
      const opacity = this.baseOpacity * calm * beam.strength * pulse;
      for (const blade of beam.blades) {
        blade.material.opacity = opacity * this.facing(blade, beam.center, cameraPosition);
      }
      if (beam.pool) {
        // Same phase as its shaft: a pool that brightens while its beam dims
        // immediately stops looking like the beam is what lit it.
        beam.pool.opacity = this.poolOpacity * calm * beam.strength * pulse;
      }
    }
  }

  /**
   * How squarely a blade faces the camera, as a multiplier that is 1 over
   * everything but the last few degrees before edge-on. The normal is constant
   * over the quad's plane, so this measures the camera's distance from that
   * plane relative to its distance from the beam — which is exactly the
   * condition that collapses the quad to a line.
   */
  private facing(blade: Blade, center: Vector3, cameraPosition?: Vector3): number {
    if (!cameraPosition) {
      return 1;
    }
    const view = this.viewScratch.subVectors(center, cameraPosition);
    const distance = view.length();
    if (distance < 1e-4) {
      return 1;
    }
    view.multiplyScalar(1 / distance);
    return smoothStep(EDGE_ON_FADE_IN, EDGE_ON_FADE_OUT, Math.abs(view.dot(blade.normal)));
  }
}

/**
 * Writes each blade's fade into the sand into its vertex colours.
 *
 * Vertex colours rather than a second map because the quantity is a world-space
 * height above the seabed, which no texture axis on a tilted quad corresponds
 * to — the caustics sheet carries its reach the same way and for the same
 * reason.
 */
function bakeGroundFade(geometry: PlaneGeometry, toWorld: Matrix4): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const point = new Vector3();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(toWorld);
    const above = point.y - seabedHeight(point.x, point.z);
    const fade = smoothStep(GROUND_FADE_START, GROUND_FADE_END, above);
    colors[i * 3] = fade;
    colors[i * 3 + 1] = fade;
    colors[i * 3 + 2] = fade;
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * Both maps are content-identical for every beam in every room, so they are
 * built once and shared. Two rooms' worth of shafts is the case that made it
 * worth doing: nothing here varies per instance, and the pool's spin and dune
 * fitting are baked into its geometry rather than its texture.
 */
let shaftTexture: CanvasTexture | null | undefined;
function shaftMap(): CanvasTexture | null {
  if (shaftTexture === undefined) {
    shaftTexture = createShaftTexture();
  }
  return shaftTexture;
}

let poolTexture: DataTexture | undefined;
function poolMap(): DataTexture {
  poolTexture ??= createPoolTexture();
  return poolTexture;
}

/**
 * How sharply the beam's brightness falls from its axis to its edges.
 *
 * It was 2.2, which puts most of a beam's light in the middle third of its
 * width and gives it two definite sides — a searchlight, and the harder the
 * sides the more the beam reads as a solid object hanging in the water. At 1.4
 * the bell is nearly flat across the core and spends the outer half of the
 * width feathering, so a beam this wide has no edge to find anywhere. It is the
 * softness, not the width, that turns a shaft into a ribbon.
 */
const BELL_EXPONENT = 1.4;

/**
 * A soft-edged beam: a bell across the width so the sides never show a hard
 * boundary, fading out along its length as the light is absorbed.
 *
 * The one map here still painted into a canvas, so like the fog's gradient it
 * returns null where there is no DOM — which is what keeps a scene that owns
 * shafts constructible in the plain Node unit tests.
 */
function createShaftTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

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
        const bell = Math.pow(Math.cos((across * Math.PI) / 2), BELL_EXPONENT);
        const alpha = Math.max(0, bell * fade);
        const index = (y * width + x) * 4;
        image.data[index] = 255;
        image.data[index + 1] = 244;
        image.data[index + 2] = 214;
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
    // The disc's rim lands exactly on this circle: a ring's UVs run from the
    // centre out to the unit circle inscribed in the map.
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.84 + 0.34 * wobble));
    // Where the wobble pushes the falloff outward it can still be lit at that
    // rim, and light in the outermost texels is a bright ring around the
    // geometry. This closes it off short of the edge, in the stretch where the
    // halo below is already down to a few percent.
    const inside = 1 - smoothStep(POOL_TEXTURE_FADE_IN, POOL_TEXTURE_FADE_OUT, rim);
    if (inside <= 0) {
      return 0;
    }

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
    return Math.min(1, 0.52 * core + 0.48 * halo * grain) * inside;
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
