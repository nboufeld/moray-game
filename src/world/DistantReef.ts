import {
  BufferGeometry,
  Color,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { fbm } from "../rendering/ProceduralTexture";
import { Random, SEEDS } from "../util/Random";
import { REGION_SLOTS } from "./regions/RegionSlots";
import { SoftRingBuilder, endAlpha, softCurtainMaterial } from "./regions/kit/HorizonCurtain";

/**
 * The painted distance: receding silhouette layers beyond the rim (W-L9).
 *
 * A Ghibli background is built from flat planes of colour standing one behind
 * another, each a little closer to the sky's own value, and the reef had none
 * of them — beyond the rim the world simply stopped, and every horizon was the
 * fog and nothing else. These are those planes: three rings of simplified
 * reef skyline standing at 52, 64 and 78 metres, dark near, milky far, so that
 * whichever way a camera looks the world visibly continues.
 *
 * ## Why they carry no fog
 *
 * The scene's `FogExp2` at 0.028 has all but closed by fifty metres — a fogged
 * mesh out here would render as the fog colour exactly, which is invisibility
 * with extra draw calls. So the materials are `fog: false` and the *tint does
 * the fog's job by hand*: each layer's colour is the fog colour taken down a
 * violet-leaning step, mixed back toward the fog by its own distance. That is
 * also precisely what a background painter does — mix the mountain's colour
 * from the sky's.
 *
 * The fog colour is not a constant: `UnderwaterFog.adoptBackdrop` re-derives
 * it from the painted backdrop when the file lands. So the tints are re-read
 * off `scene.fog` in an `onBeforeRender` hook — one colour compare per frame,
 * three lerps when it actually changes — the same self-winding trick
 * `CoralField`'s sway uses, and for the same reason: nothing owns an update
 * call into this module and nothing needs to.
 *
 * ## The critic's wave (hard-geometry purge, C4)
 *
 * Ten of ten Tier-B wings showed a flat-polygon backdrop read, and every one
 * traced to THESE rings: from inside a wing (or at its doorway) the nearest
 * ring stands 5–40 m past the rim as an unfogged flat cut-out in the bowl's
 * own teal — the moonlit "moon pool" polygon, the wreck-meadow diagonal seam,
 * the current-run ghost pyramid, the ruins-terrace sky triangles. Two class
 * moves fix the family without costing the bowl its skyline:
 *
 * - **Soft grammar** (kit `HorizonCurtain`): three rows, RGBA, the crest
 *   dissolving to alpha 0 — no razor tops, no hard peak triangles.
 * - **The camera-following parting**: when the camera stands out in the wing
 *   belt (r ≳ 19 m — every wing interior and doorway stand, never the bowl's
 *   heart), the ring sector AHEAD of it eases down like the gateway partings,
 *   so no doorway or rim notch ever frames a cut-out. The painted backdrop —
 *   which every wing mood already fades correctly — shows instead. From the
 *   bowl the skyline is untouched.
 *
 * ## What it costs
 *
 * Three meshes, three draw calls, ~2.2k triangles between them, no textures,
 * no shadows in either direction, `MeshBasicMaterial` throughout (a silhouette
 * is a mark, not a shaded surface — the same argument as the cave mouths).
 * Everything is seeded from `SEEDS.distantReef` and built from pure geometry,
 * so it constructs in plain Node and never touches the asset pipeline.
 */

/** One ring of skyline. Radius in metres; heights of the silhouette band. */
interface SkylineLayer {
  readonly radius: number;
  readonly baseHeight: number;
  readonly varyHeight: number;
  /** How many tall pinnacle spikes interrupt the ridge line. */
  readonly peaks: number;
  readonly peakHeight: number;
  /** 0 keeps the full ink; 1 dissolves into the fog entirely. */
  readonly fade: number;
}

const LAYERS: readonly SkylineLayer[] = [
  { radius: 52, baseHeight: 6.5, varyHeight: 3.6, peaks: 5, peakHeight: 5, fade: 0.42 },
  { radius: 64, baseHeight: 9.5, varyHeight: 4.4, peaks: 4, peakHeight: 6.5, fade: 0.6 },
  { radius: 78, baseHeight: 13, varyHeight: 5, peaks: 3, peakHeight: 8.5, fade: 0.76 },
];

/** Azimuth resolution. At 78 m a segment is 2.5 m — well under what fog resolves. */
const SEGMENTS = 192;

/** Metres the curtain's foot sinks below the dunes, so no gap ever opens. */
const FOOT = 3;

/**
 * The ink the near layer would wear with no fade at all, as a multiplier on
 * the fog colour. Darker and violet-leaning — red held above green's cut, per
 * the value key: a distant mass is a cooler, dimmer version of the water, and
 * with red below green it stops being violet and goes electric.
 */
const INK = new Color(0.66, 0.72, 0.9);

// ─── The gateway partings (connective-1) ────────────────────────────────────
//
// Wave 8 opened six gateway doorways through the rim, and these rings stood
// straight across all of them: through every opened end wall the "country
// beyond" rendered as a flat fog-coloured plane at 52 m — the fill program's
// "flat cyan cut-out", the worst seam in the game. So the skyline PARTS
// over each gateway's sight cone, the same gesture MASTER R4 legislates for
// distance rings over passes: within the cone the curtain's whole column
// eases down to its buried foot, and the doorway shows the water, the gate
// veil, and eventually the region's own painted distance instead of a wall.
// Between doorways nothing moves — the profile arithmetic is untouched and
// the gap multiplier is exactly 1 there.

/** The gateway azimuths — one per province spoke, from the world map. */
const GATEWAY_AZIMUTHS: readonly number[] = [
  ...new Set(REGION_SLOTS.map((slot) => slot.azimuth)),
];

/** Where a doorway stands, and how a sight line through it spreads. */
const DOOR_R = 48.5;
const DOOR_HALF_WIDTH = 8;
/** Lateral growth per metre past the door, for an eye at the wing's heart. */
const DOOR_SPREAD = 0.66;
/** Radians of shoulder each parting eases over. Round 3's finding: at
 *  0.06 the shoulders stood near-vertical and read as rectangular notches
 *  cut out of the painted sky from low poses; at 0.14 the skyline DIPS
 *  through a doorway the way a ridge line dips through a pass. */
const GAP_BLEND = 0.14;
/** Cap so a far ring's parting can never swallow a neighbouring wing. */
const GAP_HALF_MAX = 0.24;

// ─── The camera-following parting (hard-geometry purge) ─────────────────────

/** Camera radius across which the follow-parting arms: 0 in the bowl's
 *  heart, 1 by the wing sills — every interior and doorway stand. */
const FOLLOW_FROM = 19;
const FOLLOW_SPAN = 6;
/** The parted sector's half-angles: full cut inside, eased out by. */
const FOLLOW_CONE_IN = 0.36;
const FOLLOW_CONE_OUT = 0.64;

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** 1 away from every doorway, easing to 0 inside a gateway's sight cone. */
function gatewayKeep(theta: number, radius: number): number {
  const spread = Math.min(
    GAP_HALF_MAX,
    Math.atan((DOOR_HALF_WIDTH + (radius - DOOR_R) * DOOR_SPREAD) / radius),
  );
  let keep = 1;
  for (const azimuth of GATEWAY_AZIMUTHS) {
    keep = Math.min(keep, smoothstep01((angleBetween(theta, azimuth) - spread) / GAP_BLEND));
  }
  return keep;
}

export class DistantReef {
  readonly group = new Group();

  private readonly materials: MeshBasicMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly partUniforms: { value: number }[][] = [];
  private lastFog = -1;

  constructor(seed: number = SEEDS.distantReef) {
    this.group.name = "distant-reef";
    const random = new Random(seed);

    for (const [index, layer] of LAYERS.entries()) {
      const material = softCurtainMaterial({
        // A placeholder close to the shipped fog; corrected on first render.
        color: new Color(0x53b2bb).lerp(new Color(0x53b2bb).multiply(INK), 1 - layer.fade),
      });
      const uniforms = [{ value: 10 }, { value: 0 }];
      material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        shader.uniforms.uPartAz = uniforms[0]!;
        shader.uniforms.uPartK = uniforms[1]!;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vRingWorld;")
          .replace(
            "#include <worldpos_vertex>",
            "#include <worldpos_vertex>\nvRingWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vRingWorld;\nuniform float uPartAz;\nuniform float uPartK;",
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
             // The camera-following parting: the sector ahead of a camera
             // standing in the wing belt eases open, so no doorway or rim
             // notch ever frames this ring as a flat cut-out.
             float ringTheta = atan(vRingWorld.z, vRingWorld.x);
             float ringDelta = abs(atan(sin(ringTheta - uPartAz), cos(ringTheta - uPartAz)));
             diffuseColor.a *= 1.0 - uPartK * (1.0 - smoothstep(${FOLLOW_CONE_IN.toFixed(2)}, ${FOLLOW_CONE_OUT.toFixed(2)}, ringDelta));`,
          );
      };
      material.customProgramCacheKey = () => "distant-reef-follow-parting";
      const geometry = skylineRing(layer, random, seed + index * 131);
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = -(index + 3);
      if (index === 0) {
        mesh.onBeforeRender = (_renderer, scene, camera) => {
          this.followFog(scene);
          const cameraR = Math.hypot(camera.position.x, camera.position.z);
          const azimuth = Math.atan2(camera.position.z, camera.position.x);
          const strength = smoothstep01((cameraR - FOLLOW_FROM) / FOLLOW_SPAN);
          for (const [az, k] of this.partUniforms) {
            az!.value = azimuth;
            k!.value = strength;
          }
        };
      }
      this.group.add(mesh);
      this.materials.push(material);
      this.geometries.push(geometry);
      this.partUniforms.push(uniforms);
    }
  }

  /**
   * Re-derives every layer's tint from the water the scene actually has.
   * The backdrop can land a second after the reef stands, and the sanctuary
   * never constructs one of these, so the reef's fog is the only caller.
   */
  private followFog(scene: Scene): void {
    const fog = scene.fog;
    if (!(fog instanceof FogExp2)) {
      return;
    }
    const hex = fog.color.getHex();
    if (hex === this.lastFog) {
      return;
    }
    this.lastFog = hex;

    const ink = fog.color.clone().multiply(INK);
    for (const [index, layer] of LAYERS.entries()) {
      this.materials[index]?.color.copy(ink).lerp(fog.color, layer.fade);
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}

/**
 * One ring: a soft curtain whose top edge is the layer's skyline.
 *
 * The profile is fbm over azimuth — periodic by construction, since the noise
 * lattice wraps on its integer period and one full turn is exactly one period
 * — with a handful of taller pinnacle spikes lifted out of it at seeded
 * azimuths, because a ridge line with no verticals reads as a wall and this
 * reef's own skyline is sea stacks. The spikes' tips ride the soft grammar's
 * crest dissolve, so a stack is a fading mark in the water, never a hard
 * teal triangle over a wing's rim.
 */
function skylineRing(layer: SkylineLayer, random: Random, noiseSeed: number): BufferGeometry {
  const peaks: { at: number; height: number; halfWidth: number }[] = [];
  for (let i = 0; i < layer.peaks; i++) {
    peaks.push({
      at: random.range(0, Math.PI * 2),
      height: layer.peakHeight * random.range(0.6, 1),
      halfWidth: random.range(0.05, 0.11),
    });
  }

  const builder = new SoftRingBuilder();

  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const u = i / SEGMENTS;
    const ridge =
      layer.baseHeight +
      (fbm(u * 6, layer.radius * 0.01, { seed: noiseSeed, period: 6, octaves: 3 }) - 0.5) *
        2 *
        layer.varyHeight;

    let spike = 0;
    for (const peak of peaks) {
      const delta = angleBetween(theta, peak.at);
      if (delta < peak.halfWidth * Math.PI) {
        const t = 1 - delta / (peak.halfWidth * Math.PI);
        spike = Math.max(spike, peak.height * t * t);
      }
    }

    const x = Math.cos(theta) * layer.radius;
    const z = Math.sin(theta) * layer.radius;
    // The parting: inside a gateway's sight cone the column collapses onto
    // its own buried foot, below every doorway sill.
    const keep = gatewayKeep(theta, layer.radius);
    builder.column(x, z, -FOOT, -FOOT + keep * (Math.max(1.2, ridge + spike) + FOOT), {
      alpha: endAlpha(keep),
    });
  }

  return builder.build();
}

/** Shortest angular distance between two azimuths, in [0, π]. */
function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
