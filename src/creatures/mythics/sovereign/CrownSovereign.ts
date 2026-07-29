import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
  Vector3,
  type BufferGeometry as Geometry,
  type Material,
  type MeshToonMaterial,
} from "three";
import { requestModel } from "../../../rendering/AssetLibrary";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { LUMEN_GARDEN } from "../../../world/wings/defs/LumenGarden";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import type { LifeContext } from "../../life/LifeSystem";
import { MythicBody, retireFallback } from "../shared/MythicBody";

/** The brief's hard ceiling; asserted in tests and in the build script. */
export const SOVEREIGN_TRI_BUDGET = 3000;
export const SOVEREIGN_MODEL_PATH = "models/creature-crown-jelly.glb";

/**
 * The throne: on the Lumen Garden's axis at r ≈ 42, rising and sinking
 * through y 1–5 on a 44-second breath, with a drift small enough that the
 * glow column stays a place rather than a patrol.
 */
export const SOVEREIGN_HOME = {
  azimuth: LUMEN_GARDEN.azimuth,
  radius: 42,
  risePeriod: 44,
  riseCentre: 3,
  riseAmplitude: 2,
  driftRadius: 1.2,
  driftPeriod: 64,
} as const;

/** The pulse: the bloom's idiom at statelier tempo and depth. */
const PULSE_HZ = 0.13;
const PULSE_SQUASH = 0.08;
const PULSE_STRETCH = 0.13;

/** How far the bell leans against its own rise; the tendrils' lag reads. */
const TRAIL_TILT = 0.055;
const PRECESSION_PERIOD = 180;

/** A faint violet presence so the bell never reads as a hole in the dark. */
const GLOW = 0x4a3f78;
const GLOW_INTENSITY = 0.16;

/**
 * The coronet's lamp (W7): wherever the painted colour runs warm — the
 * gold-rose crown ring, the spike tips, the tendril ends — the vertex
 * colour's red stands a full step over its blue, and only there. The bell
 * itself is indigo (blue over red) and catches nothing. This is the
 * bloom's `BELL_RIM_CHUNK` idiom keyed on authored value rather than on
 * view angle, and a module constant for the same program-cache reason:
 * three hashes `onBeforeCompile.toString()`, so all sovereigns share one
 * program. The peak stays under the bloom pass's 0.82 threshold — a lamp,
 * never a light source.
 */
const CROWN_GLOW_CHUNK = /* glsl */ `
  float crownGlow = smoothstep( 0.10, 0.55, vColor.r - vColor.b );
  totalEmissiveRadiance += vec3( 1.0, 0.58, 0.34 ) * crownGlow * 0.55;
  #include <normal_fragment_maps>
`;

const injectCrownGlow: MeshToonMaterial["onBeforeCompile"] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_maps>",
    CROWN_GLOW_CHUNK,
  );
};

/**
 * The sovereign's one skin: vertex-coloured toon, double-sided for the
 * zero-thickness spikes and tendrils, wearing the crown lamp. Fallback
 * and GLB both carry the palette in their vertex colours, so the one
 * material dresses whichever body is on stage.
 */
function createSovereignMaterial(): MeshToonMaterial {
  const material = createToonMaterial({
    vertexColors: true,
    side: DoubleSide,
    emissive: GLOW,
    emissiveIntensity: GLOW_INTENSITY,
  });
  material.name = "crown-sovereign";
  material.onBeforeCompile = injectCrownGlow;
  return material;
}

interface SovereignRig {
  /** pulse in [-1, 1]; the two sway angles rock the tendrils. */
  pose(pulse: number, swayX: number, swayZ: number): void;
}

/**
 * The Crown Jelly Sovereign, holding court in the Lumen Garden's deep
 * dark. It does not patrol: it rises and sinks through its own glow
 * column, pulses slowly, and trails twelve tendrils with a stately delay.
 * The discovery point rides the bell itself.
 */
export class CrownSovereign extends MythicBody {
  readonly target: DiscoveryTarget;

  private readonly homeX: number;
  private readonly homeZ: number;
  private readonly risePhase: number;
  private readonly driftPhase: number;
  private readonly pulsePhase: number;

  private rig: SovereignRig;
  private fallback: Group | null;
  private readonly material = this.own(createSovereignMaterial());

  constructor(seed: number = SEEDS.mythSovereign) {
    super("crown-sovereign");
    const random = new Random(seed);
    this.risePhase = random.range(0, Math.PI * 2);
    this.driftPhase = random.range(0, Math.PI * 2);
    this.pulsePhase = random.range(0, Math.PI * 2);
    this.homeX = SOVEREIGN_HOME.radius * Math.cos(SOVEREIGN_HOME.azimuth);
    this.homeZ = SOVEREIGN_HOME.radius * Math.sin(SOVEREIGN_HOME.azimuth);

    const built = buildFallbackSovereign(this.material, (r) => this.own(r));
    this.fallback = built.fallback;
    this.rig = built.rig;
    this.body.add(built.fallback);

    this.target = { speciesId: "myth-crown-sovereign", position: new Vector3() };
    this.update(0, {
      diverPosition: new Vector3(),
      diverSpeed: 0,
      reducedMotion: false,
      time: 0,
    });

    requestModel(SOVEREIGN_MODEL_PATH, (geometry) => this.adoptModel(geometry));
  }

  update(_dt: number, ctx: LifeContext): void {
    const t = ctx.time;
    const calm = ctx.reducedMotion ? 0.5 : 1;
    const slow = ctx.reducedMotion ? 0.55 : 1;

    const riseBeat = (Math.PI * 2 * t * slow) / SOVEREIGN_HOME.risePeriod + this.risePhase;
    const y = SOVEREIGN_HOME.riseCentre + SOVEREIGN_HOME.riseAmplitude * Math.sin(riseBeat);
    const vy = SOVEREIGN_HOME.riseAmplitude * (Math.PI * 2 * slow) / SOVEREIGN_HOME.risePeriod * Math.cos(riseBeat);

    const driftBeat = (Math.PI * 2 * t * slow) / SOVEREIGN_HOME.driftPeriod + this.driftPhase;
    this.body.position.set(
      this.homeX + SOVEREIGN_HOME.driftRadius * Math.cos(driftBeat),
      y,
      this.homeZ + SOVEREIGN_HOME.driftRadius * Math.sin(driftBeat),
    );

    // The lean: against the rise, so the trailing tendrils read as towed;
    // plus a precession slow enough to feel like breathing room air.
    const tilt = Math.max(-0.12, Math.min(0.12, -vy * TRAIL_TILT)) * calm;
    this.body.rotation.set(tilt, (Math.PI * 2 * t) / PRECESSION_PERIOD, tilt * 0.4, "YXZ");

    const pulse = Math.sin(Math.PI * 2 * t * PULSE_HZ * slow + this.pulsePhase) * calm;
    this.rig.pose(
      pulse,
      Math.sin(t * 0.21 + this.driftPhase) * 0.06 * calm,
      Math.cos(t * 0.17 + this.driftPhase) * 0.06 * calm,
    );

    this.target.position.set(0, 0.25, 0).applyQuaternion(this.body.quaternion).add(this.body.position);
  }

  /** The GLB landed: one mesh wearing everything, the stand-in retires. */
  private adoptModel(geometry: Geometry): void {
    if (this.isDisposed) {
      return;
    }
    const mesh = new Mesh(geometry, this.material);
    mesh.name = "crown-sovereign-glb";
    this.body.add(mesh);
    if (this.fallback) {
      this.body.remove(this.fallback);
      retireFallback(this.fallback, new Set([this.material]), (r) => this.disposeOwned(r));
      this.fallback = null;
    }
    this.rig = {
      pose: (pulse) => {
        mesh.scale.set(
          1 - PULSE_SQUASH * pulse,
          1 + PULSE_STRETCH * pulse,
          1 - PULSE_SQUASH * pulse,
        );
      },
    };
  }
}

/**
 * The no-assets sovereign: a lathe bell following the GLB's silhouette
 * (2.2 m across, apex +0.72, the margin recurving under), twelve flattened
 * cones for the coronet's spikes, and twelve wavy ribbons for the
 * tendrils — every vertex wearing the palette, so the crown lamp lights
 * the stand-in exactly as it lights the model.
 */
function buildFallbackSovereign(
  material: Material,
  own: <T extends Geometry | Material>(r: T) => T,
): { fallback: Group; rig: SovereignRig } {
  const fallback = new Group();
  fallback.name = "sovereign-fallback";

  const apex = new Color(0x4b418b).convertSRGBToLinear();
  const margin = new Color(0x5c4799).convertSRGBToLinear();
  const inner = new Color(0x2f2667).convertSRGBToLinear();
  const crown = new Color(0xffbb6e).convertSRGBToLinear();
  const root = new Color(0x6652a8).convertSRGBToLinear();
  const tip = new Color(0xf2b885).convertSRGBToLinear();

  // The bell: profile rows, the coronet painted where the GLB swells.
  const profile = [
    new Vector2(0.001, 0.72),
    new Vector2(0.35, 0.665),
    new Vector2(0.7, 0.53),
    new Vector2(0.95, 0.40),
    new Vector2(1.05, 0.33),
    new Vector2(1.1, 0.24),
    new Vector2(1.13, 0.1),
    new Vector2(1.08, -0.02),
    new Vector2(0.9, 0.02),
    new Vector2(0.62, 0.12),
    new Vector2(0.3, 0.22),
  ];
  const bellGeometry = own(new LatheGeometry(profile, 24));
  bellGeometry.computeVertexNormals();
  const mixed = new Color();
  const bellColors = new Float32Array(bellGeometry.getAttribute("position").count * 3);
  const positions = bellGeometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const radius = Math.hypot(positions.getX(i), positions.getZ(i));
    const t = Math.min(1, Math.max(0, 1 - y / 0.72));
    if (y < 0.06 && radius < 1.0) {
      mixed.copy(inner);
    } else if (y > 0.22 && y < 0.42 && radius > 0.9) {
      mixed.copy(crown);
    } else {
      mixed.copy(apex).lerp(margin, t);
    }
    bellColors[i * 3] = mixed.r;
    bellColors[i * 3 + 1] = mixed.g;
    bellColors[i * 3 + 2] = mixed.b;
  }
  bellGeometry.setAttribute("color", new BufferAttribute(bellColors, 3));
  const bell = new Mesh(bellGeometry, material);
  fallback.add(bell);

  // The coronet's points: flattened cones standing proud of the band.
  const spikeGeometry = own(new ConeGeometry(0.045, 0.17, 4));
  const spikeColors = new Float32Array(spikeGeometry.getAttribute("position").count * 3);
  for (let i = 0; i < spikeGeometry.getAttribute("position").count; i++) {
    spikeColors[i * 3] = crown.r;
    spikeColors[i * 3 + 1] = crown.g;
    spikeColors[i * 3 + 2] = crown.b;
  }
  spikeGeometry.setAttribute("color", new BufferAttribute(spikeColors, 3));
  const spikes = new Group();
  for (let k = 0; k < 12; k++) {
    const theta = (Math.PI * 2 * k) / 12;
    const spike = new Mesh(spikeGeometry, material);
    spike.position.set(Math.cos(theta) * 1.08, 0.42, Math.sin(theta) * 1.08);
    spike.rotation.set(Math.sin(theta) * 0.7, 0, -Math.cos(theta) * 0.7, "YXZ");
    spikes.add(spike);
  }
  bell.add(spikes);

  // The tendrils: twelve ribbons, indigo at the root, pale gold at the tip.
  const tendrilGeometry = own(buildTendrilRibbons(root, tip));
  const tendrils = new Mesh(tendrilGeometry, material);
  fallback.add(tendrils);

  const rig: SovereignRig = {
    pose: (pulse, swayX, swayZ) => {
      bell.scale.set(1 - PULSE_SQUASH * pulse, 1 + PULSE_STRETCH * pulse, 1 - PULSE_SQUASH * pulse);
      // The tendrils stretch as the bell contracts, the way drag would.
      tendrils.scale.y = 1 - pulse * 0.12;
      tendrils.rotation.x = swayX;
      tendrils.rotation.z = swayZ;
    },
  };
  return { fallback, rig };
}

/** Twelve hanging ribbons with a baked wave, in the bloom's tentacle idiom. */
function buildTendrilRibbons(root: Color, tip: Color): Geometry {
  const ribbons = 12;
  const segments = 9;
  const length = 1.6;
  const vertsPerRibbon = (segments + 1) * 2;
  const positions = new Float32Array(ribbons * vertsPerRibbon * 3);
  const colors = new Float32Array(ribbons * vertsPerRibbon * 3);
  const indices: number[] = [];
  const mixed = new Color();

  for (let r = 0; r < ribbons; r++) {
    const angle = (Math.PI * 2 * (r + 0.5)) / ribbons;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const px = -dz;
    const pz = dx;
    const phase = 1.7 * r;
    const base = r * vertsPerRibbon;
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const width = 0.042 * (1 - t) + 0.006;
      const sway = Math.sin(t * 2.6 + phase) * 0.1 * t * t;
      const reach = 1.0 + 0.16 * t * t;
      const y = 0.34 - t * length;
      mixed.copy(root).lerp(tip, Math.min(1, Math.max(0, (t - 0.25) / 0.75)));
      for (let side = 0; side < 2; side++) {
        const index = base + j * 2 + side;
        const w = side === 0 ? -width : width;
        positions[index * 3] = dx * reach + px * (sway + w);
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = dz * reach + pz * (sway + w);
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
