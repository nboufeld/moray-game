import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
  Vector3,
  type MeshToonMaterial,
} from "three";
import { requestModel } from "../../rendering/AssetLibrary";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import type { LifeContext } from "../life/LifeSystem";
import { VisitorBase } from "./VisitorBase";
import { playVisitorEvent } from "./VisitorDirector";
import { BankedArc } from "./VisitorPath";

/** How many bells a bloom brings; drawn once, so a bloom is always itself. */
const BELLS_MIN = 5;
const BELLS_MAX = 9;

/**
 * How many bells wear the modelled shell. The GLB is 1200 triangles and the
 * lathe stand-in 192, and on the vertex-bound software rasteriser the probes
 * run on that difference is the whole budget: nine modelled bells measured
 * 5.5ms paired where the +2ms allotment lives. The bloom crosses no closer
 * than about thirteen metres to the canonical cameras, where a scalloped
 * margin and a smooth one are the same twenty pixels — so three leads carry
 * the silhouette and the chorus wears the stand-in, assigned by slot so the
 * split never pops.
 */
const LEAD_BELLS = 3;

/** The cloud's own size: offsets inside a flattened ellipsoid this big. */
const CLOUD_RADIUS = 2.1;
const CLOUD_HEIGHT = 1.3;

const ARC_RANGES = {
  entryRadius: 26,
  heightMin: 3.4,
  heightMax: 5.2,
  bow: 8,
  speed: 0.5,
  bank: 0,
} as const;

/** The pulse: slow, and different for every bell so the cloud breathes. */
const PULSE_HZ_MIN = 0.28;
const PULSE_HZ_MAX = 0.42;
const PULSE_SQUASH = 0.1;
const PULSE_STRETCH = 0.14;

/**
 * A faint glow inside the bloom, sized against the bloom pass's threshold
 * (0.82 in the composer): a lift the grade can feel, never a light source.
 */
const GLOW = 0x8d74c0;
const GLOW_INTENSITY = 0.16;

/**
 * The rim that turns a bell from a button into a creature (W-N3).
 *
 * A jellyfish is mostly water and its whole character is that light leaks
 * around and through it; a ramp-shaded opaque dome has none of that, and the
 * round critic called the sanctuary's bells "flat purple buttons with zero
 * translucency". Real transmission is a shader this project does not buy —
 * the cheat is a fresnel-weighted emissive: wherever the shell turns away
 * from the view its edge lifts toward a pale violet, which is exactly where
 * a translucent bell goes bright against the water. It is emissive so it
 * survives shade the way the morays' rim light does, and it is added to
 * `totalEmissiveRadiance` before the emissive map stage, so it rides
 * independent of `emissiveIntensity`. The peak channel stays near 0.5 —
 * well under the bloom pass's 0.82 threshold even over the base glow,
 * because a bell may glow and may never be a light source.
 *
 * A module constant, for the program-cache reason every injected chunk in
 * this project is one: three hashes `onBeforeCompile.toString()`, so the
 * reef bloom's bells and the sanctuary's share a single program.
 */
const BELL_RIM_CHUNK = /* glsl */ `
  float bellRim = 1.0 - abs( dot( normalize( vViewPosition ), normal ) );
  totalEmissiveRadiance += vec3( 0.40, 0.34, 0.55 ) * pow( bellRim, 2.5 ) * 0.85;
  #include <normal_fragment_maps>
`;

const injectBellRim: MeshToonMaterial["onBeforeCompile"] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_maps>",
    BELL_RIM_CHUNK,
  );
};

/**
 * The one door a jelly bell's skin comes through (W-N3): vertex-coloured toon
 * with the bloom's glow and the fresnel rim above. Exported for the same
 * reason `buildFallbackBell` is — the sanctuary's drifting bells are the same
 * animal as the reef's bloom, and a material recipe written twice is two
 * jellyfish. Each caller owns the instance it is handed.
 */
export function createJellyBellMaterial(): MeshToonMaterial {
  const material = createToonMaterial({
    vertexColors: true,
    emissive: GLOW,
    emissiveIntensity: GLOW_INTENSITY,
  });
  material.name = "jelly-bell";
  material.onBeforeCompile = injectBellRim;
  return material;
}

const AUDIO_RANGE = 14;
const AUDIO_PERIOD = 4;

interface BellSlot {
  readonly holder: Group;
  readonly bell: Mesh;
  readonly tentacles: Mesh;
  readonly offset: Vector3;
  readonly scale: number;
  readonly pulseHz: number;
  readonly phase: number;
  readonly wanderPhase: number;
}

/**
 * A drifting raft of pulsing bells, mid-water.
 *
 * The bell is `creature-jelly-bell.glb` — pastel violet vertex colours, no
 * joints, because a pulse is a scale animation — worn by the {@link LEAD_BELLS}
 * leads, while the chorus keeps the lathe stand-in that carries the same
 * colour story (and is the whole bloom in the no-assets build). The tentacles
 * are the cheap kind the brief allows: crossed tapered ribbons under each
 * bell, one shared geometry, swayed by tilting the mesh rather than by any
 * shader.
 */
export class JellyBloom extends VisitorBase {
  private arc: BankedArc;
  private readonly slots: BellSlot[] = [];
  private audioCountdown = 0;

  constructor(seed: number = SEEDS.visitors) {
    super("jelly-bloom", seed, "jelly-bloom");
    const random = new Random(SEEDS.jellyBloom);
    this.arc = new BankedArc(random, ARC_RANGES);

    const bellMaterial = this.own(createJellyBellMaterial());
    const tentacleMaterial = this.own(
      createToonMaterial({
        vertexColors: true,
        emissive: GLOW,
        emissiveIntensity: GLOW_INTENSITY * 0.5,
        side: DoubleSide,
      }),
    );

    const bellGeometry = this.own(buildFallbackBell());
    const tentacleGeometry = this.own(buildTentacles());

    const count = Math.floor(random.range(BELLS_MIN, BELLS_MAX + 1));
    for (let i = 0; i < count; i++) {
      const holder = new Group();
      const bell = new Mesh(bellGeometry, bellMaterial);
      const tentacles = new Mesh(tentacleGeometry, tentacleMaterial);
      tentacles.rotation.y = random.range(0, Math.PI);
      holder.add(bell);
      holder.add(tentacles);
      this.root.add(holder);
      this.slots.push({
        holder,
        bell,
        tentacles,
        offset: new Vector3(
          random.signed(CLOUD_RADIUS),
          random.signed(CLOUD_HEIGHT),
          random.signed(CLOUD_RADIUS),
        ),
        scale: random.range(0.95, 1.35),
        pulseHz: random.range(PULSE_HZ_MIN, PULSE_HZ_MAX),
        phase: random.range(0, Math.PI * 2),
        wanderPhase: random.range(0, Math.PI * 2),
      });
    }

    requestModel("models/creature-jelly-bell.glb", (geometry) => {
      // Leads only; the chorus keeps the lathe, which therefore stays owned
      // and alive rather than being disposed the way a retired stand-in is.
      for (const slot of this.slots.slice(0, LEAD_BELLS)) {
        slot.bell.geometry = geometry;
      }
    });
  }

  protected override onPassStarted(): void {
    this.audioCountdown = 1;
  }

  protected advancePass(dt: number, ctx: LifeContext): void {
    const s = this.passTime / this.arc.duration;
    if (s >= 1) {
      this.endPass();
      return;
    }

    this.arc.positionAt(s, this.root.position);

    const calm = ctx.reducedMotion ? 0.5 : 1;
    for (const slot of this.slots) {
      const beat = this.passTime * slot.pulseHz * Math.PI * 2 + slot.phase;
      const pulse = Math.sin(beat) * calm;
      slot.bell.scale.set(
        1 - PULSE_SQUASH * pulse,
        1 + PULSE_STRETCH * pulse,
        1 - PULSE_SQUASH * pulse,
      );
      // The tentacles stretch as the bell contracts, the way drag would.
      slot.tentacles.scale.y = 1 - pulse * 0.1;
      slot.tentacles.rotation.x = Math.sin(beat * 0.31 + slot.wanderPhase) * 0.1 * calm;
      slot.tentacles.rotation.z = Math.cos(beat * 0.27 + slot.wanderPhase) * 0.1 * calm;

      // A gentle individual wander inside a cloud that stays a cloud.
      const wander = this.passTime * 0.15 + slot.wanderPhase;
      slot.holder.position.set(
        slot.offset.x + Math.sin(wander) * 0.35,
        slot.offset.y + Math.sin(beat - Math.PI / 3) * 0.12 + Math.cos(wander * 0.7) * 0.2,
        slot.offset.z + Math.cos(wander * 0.9) * 0.35,
      );
      slot.holder.scale.setScalar(slot.scale);
    }

    this.audioCountdown -= dt;
    if (this.audioCountdown <= 0) {
      this.audioCountdown = AUDIO_PERIOD;
      const distance = this.root.position.distanceTo(ctx.diverPosition);
      const reach = distance - CLOUD_RADIUS;
      if (reach < AUDIO_RANGE) {
        playVisitorEvent("jelly-shimmer", 1 - Math.max(0, reach) / AUDIO_RANGE);
      }
    }
  }
}

/**
 * The no-assets bell: a lathe following the GLB's silhouette (0.64 m across,
 * apex at +0.33, margin skirt recurving under) wearing the same apex-lavender
 * to margin-rose-violet story in its vertex colours, authored in sRGB and
 * converted, since `COLOR_0` arrives linear.
 *
 * Exported (W-L8) so the sanctuary's drifting bells are the same animal as
 * the reef's bloom rather than a second drawing of it; the sanctuary owns the
 * copies it builds, exactly as this class owns its own.
 */
export function buildFallbackBell(): BufferGeometry {
  const profile = [
    new Vector2(0.001, 0.33),
    new Vector2(0.14, 0.31),
    new Vector2(0.25, 0.24),
    new Vector2(0.31, 0.13),
    new Vector2(0.32, 0.03),
    new Vector2(0.29, -0.02),
    new Vector2(0.24, 0.02),
  ];
  const geometry = new LatheGeometry(profile, 16);
  geometry.computeVertexNormals();

  const apex = new Color(0xd9cdeb).convertSRGBToLinear();
  const margin = new Color(0xa87fc2).convertSRGBToLinear();
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const mixed = new Color();
  for (let i = 0; i < positions.count; i++) {
    const t = Math.min(1, Math.max(0, 1 - positions.getY(i) / 0.33));
    mixed.copy(apex).lerp(margin, t);
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Four crossed tapering ribbons hanging from the margin ring — the cheapest
 * tentacles that read: forty triangles, one geometry shared by every bell,
 * swayed by tilting the mesh. Exported alongside {@link buildFallbackBell}.
 */
export function buildTentacles(): BufferGeometry {
  const ribbons = 4;
  const segments = 5;
  const length = 0.6;
  const vertsPerRibbon = (segments + 1) * 2;
  const positions = new Float32Array(ribbons * vertsPerRibbon * 3);
  const colors = new Float32Array(ribbons * vertsPerRibbon * 3);
  const indices: number[] = [];

  const top = new Color(0xa87fc2).convertSRGBToLinear();
  const tip = new Color(0x6c4f8f).convertSRGBToLinear();
  const mixed = new Color();

  for (let r = 0; r < ribbons; r++) {
    const angle = (r / ribbons) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const base = r * vertsPerRibbon;
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const width = 0.055 * (1 - t) + 0.008;
      // A slight outward drift so the ribbons splay under the margin.
      const reach = 0.16 + t * 0.1;
      const y = -t * length;
      mixed.copy(top).lerp(tip, t);
      for (let side = 0; side < 2; side++) {
        const index = base + j * 2 + side;
        const w = side === 0 ? -width : width;
        positions[index * 3] = dx * reach - dz * w;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = dz * reach + dx * w;
        colors[index * 3] = mixed.r;
        colors[index * 3 + 1] = mixed.g;
        colors[index * 3 + 2] = mixed.b;
      }
    }
    for (let j = 0; j < segments; j++) {
      const a = base + j * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
