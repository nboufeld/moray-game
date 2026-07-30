import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Object3D,
  Points,
  PointsMaterial,
  Sphere,
  Vector3,
  type DataTexture,
} from "three";
import { createFishGeometry, type FishBodyProfile } from "../../../creatures/fish/FishGeometry";
import { buildScalarTexture } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { KitBuild } from "./KitTypes";

/**
 * `shoalRunner` (KIT-SPEC §3.1) — the one shoal system for every road:
 * the hand-rolled CatmullRom ribbon of `VerdantLife` / `SmokingLife` /
 * `CalamityLife` extracted into route DATA, so a region's road shoal
 * and the connective traveller network are palettes of one piece.
 *
 * Everything time-dependent is a closed form of the WRAPPED loop phase
 * (`timeSec × phaseSpeed mod 1`), never of raw time and never of an
 * accumulator, which buys the two contracts the traveller network rests
 * on by construction: phase 0 and phase 1 are the same buffer to the
 * byte (loop continuity), and any dt path landing on the same `timeSec`
 * lands on the same matrices (time determinism) — two runners sharing a
 * seed across a streaming split agree on the timetable because there is
 * no state to disagree about.
 *
 * The braid rides sines of INTEGER cycles-per-loop, so the ribbon's
 * weave is seamless across the loop seam; each fish banks into its own
 * swing and noses along the path's true tangent (pitch included — the
 * smoking riders' move, for routes that climb).
 *
 * Budget note: 1 draw (+1 with glint). The body is the community's own
 * 104-tri sculpted loft (`createFishGeometry` — the spec sketch's 48-tri
 * figure predates the fish-body upgrade; the honest number is declared),
 * so 60 fish ≈ 6.3k tris. `frustumCulled = false` on the fish mesh only
 * (every instance moves every frame — law 4's sanctioned case); the
 * glint thread keeps culling under an authored route-bounds sphere.
 */

export interface ShoalRoute {
  readonly stations: readonly (readonly [number, number, number])[];
  readonly closed: boolean;
}

export interface ShoalFish {
  readonly scale: number;
  /** sRGB hex — one shoal-light per province (MASTER §1.1). */
  readonly color: number;
  /** Optional emissive lift for ribbons that must read at range. */
  readonly emissive?: number;
  readonly profile?: ShoalProfile;
}

export type ShoalProfile = "fusilier" | "tetra" | "fry";

export interface ShoalRunnerOptions {
  readonly seed: number;
  readonly route: ShoalRoute;
  /** 20–90 per the spec's budget shape. */
  readonly count: number;
  readonly fish: ShoalFish;
  /** Loop fraction per simulated second. */
  readonly phaseSpeed: number;
  /** Weave amplitudes, metres; defaults to a gentle ribbon. */
  readonly braid?: { readonly lateral: number; readonly vertical: number };
  /** An additive sparkle thread woven through the body. */
  readonly glint?: { readonly count: number; readonly size: number };
}

export interface ShoalRunnerBuild extends KitBuild {
  update(timeSec: number): void;
}

/** The community's proportions, one per road-shoal register. */
const PROFILES: Readonly<Record<ShoalProfile, Omit<FishBodyProfile, "paintSeed">>> = {
  fusilier: {
    width: 0.85,
    height: 0.95,
    length: 1.15,
    tailTaper: 0.52,
    dorsal: 0.4,
    pectoral: 0.8,
    tail: { reach: 1.5, lobe: 0.6, notch: 1.05 },
  },
  tetra: {
    width: 0.95,
    height: 1.25,
    length: 0.85,
    tailTaper: 0.5,
    dorsal: 0.85,
    pectoral: 1.0,
    tail: { reach: 1.35, lobe: 0.7, notch: 1.0 },
  },
  fry: {
    width: 0.9,
    height: 0.9,
    length: 0.95,
    tailTaper: 0.5,
    dorsal: 0.5,
    pectoral: 0.7,
    tail: { reach: 1.4, lobe: 0.6, notch: 1.0 },
  },
};

/** How much of the loop the body occupies, per fish, and its clamp. */
const SPAN_PER_FISH = 0.004;
const SPAN_MIN = 0.1;
const SPAN_MAX = 0.45;

/** The braid's beat, in seconds per cycle, before integer-per-loop rounding. */
const BRAID_PERIOD_SEC = 3.8;

/** The glint thread's margin around the route for its authored bounds. */
const GLINT_BOUNDS_MARGIN = 3;

const UP = new Vector3(0, 1, 0);

function euclidMod(value: number, span: number): number {
  return ((value % span) + span) % span;
}

let glintSpriteTexture: DataTexture | undefined;

function glintSprite(): DataTexture {
  glintSpriteTexture ??= buildScalarTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    return Math.pow(Math.max(0, 1 - distance), 2.2);
  });
  return glintSpriteTexture;
}

export function buildShoalRunner(options: ShoalRunnerOptions): ShoalRunnerBuild {
  const random = new Random(options.seed);
  const { count } = options;

  const path = new CatmullRomCurve3(
    options.route.stations.map(([x, y, z]) => new Vector3(x, y, z)),
    options.route.closed,
    "centripetal",
    0.5,
  );

  const profile = PROFILES[options.fish.profile ?? "fusilier"];
  const geometry = createFishGeometry({ ...profile, paintSeed: options.seed ^ 0x9a1e });
  const material = createToonMaterial({
    vertexColors: true,
    ...(options.fish.emissive !== undefined
      ? { emissive: options.fish.emissive, emissiveIntensity: 0.7 }
      : {}),
  });

  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "kit-shoal-runner";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // Every instance moves every frame — the one sanctioned frustum opt-out.
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const span = Math.min(SPAN_MAX, Math.max(SPAN_MIN, count * SPAN_PER_FISH));
  const braidLateral = options.braid?.lateral ?? 0.3;
  const braidVertical = options.braid?.vertical ?? 0.22;
  // Integer weave cycles per loop, so the braid is seamless at the seam.
  const braidCycles = Math.max(1, Math.round(1 / (options.phaseSpeed * BRAID_PERIOD_SEC)));

  const fishStations: {
    along: number;
    lateral: number;
    swingPhase: number;
    bobPhase: number;
    scale: number;
  }[] = [];
  const tint = new Color();
  const base = new Color(options.fish.color);
  for (let i = 0; i < count; i++) {
    fishStations.push({
      // An even comb jittered: nose-to-tail order kept, spacing organic.
      along: (i / count) * span + random.signed((span / count) * 0.45),
      lateral: random.signed(0.35),
      swingPhase: random.next(),
      bobPhase: random.next(),
      scale: options.fish.scale * random.range(0.8, 1.2),
    });
    tint.copy(base).multiplyScalar(random.range(0.85, 1.12));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const group = new Group();
  group.name = "kit-shoal-runner-group";
  group.add(mesh);

  const geometries: BufferGeometry[] = [geometry];
  const materials: (typeof material | PointsMaterial)[] = [material];
  let draws = 1;
  const triangles = ((geometry.index?.count ?? 0) / 3) * count;

  // ─── The glint thread ─────────────────────────────────────────────────────
  let glintUpdate: ((phase: number) => void) | null = null;
  if (options.glint) {
    const glintCount = options.glint.count;
    const stations = new Float32Array(glintCount * 2); // along, lift
    const phases = new Float32Array(glintCount);
    for (let i = 0; i < glintCount; i++) {
      stations[i * 2] = random.next() * span;
      stations[i * 2 + 1] = random.range(-0.5, 0.7);
      phases[i] = random.next();
    }

    const live = new Float32Array(glintCount * 3);
    const shade = new Float32Array(glintCount * 3);
    const glintGeometry = new BufferGeometry();
    const glintPosition = new BufferAttribute(live, 3);
    glintPosition.setUsage(DynamicDrawUsage);
    glintGeometry.setAttribute("position", glintPosition);
    const glintColor = new BufferAttribute(shade, 3);
    glintColor.setUsage(DynamicDrawUsage);
    glintGeometry.setAttribute("color", glintColor);

    // Authored bounds over the whole route: the thread never leaves it,
    // so the sphere is honest forever and the points keep culling.
    const bounds = new Sphere();
    const routePoints = path.getPoints(64);
    const boundsGeometry = new BufferGeometry().setFromPoints(routePoints);
    boundsGeometry.computeBoundingSphere();
    bounds.copy(boundsGeometry.boundingSphere!);
    boundsGeometry.dispose();
    bounds.radius += GLINT_BOUNDS_MARGIN;
    glintGeometry.boundingSphere = bounds;

    const glintMaterial = new PointsMaterial({
      color: 0xf4ffe8,
      size: options.glint.size,
      map: glintSprite(),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: true,
    });
    const glints = new Points(glintGeometry, glintMaterial);
    glints.name = "kit-shoal-glint";
    glints.renderOrder = 3;
    group.add(glints);
    geometries.push(glintGeometry);
    materials.push(glintMaterial);
    draws += 1;

    const at = new Vector3();
    glintUpdate = (phase: number): void => {
      for (let i = 0; i < glintCount; i++) {
        const s = euclidMod(phase - stations[i * 2]!, 1);
        path.getPointAt(s, at);
        live[i * 3] = at.x;
        live[i * 3 + 1] = at.y + stations[i * 2 + 1]!;
        live[i * 3 + 2] = at.z;
        const twinkle =
          0.35 + 0.65 * (0.5 + 0.5 * Math.sin((phase * braidCycles * 2 + phases[i]!) * Math.PI * 2));
        shade[i * 3] = twinkle;
        shade[i * 3 + 1] = twinkle;
        shade[i * 3 + 2] = twinkle;
      }
      glintPosition.needsUpdate = true;
      glintColor.needsUpdate = true;
    };
  }

  // ─── The ribbon ───────────────────────────────────────────────────────────
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();
  const side = new Vector3();

  const update = (timeSec: number): void => {
    // The ONE clock: everything below reads this wrapped phase.
    const phase = euclidMod(timeSec * options.phaseSpeed, 1);
    for (const [i, fish] of fishStations.entries()) {
      const s = euclidMod(phase - fish.along, 1);
      path.getPointAt(s, at);
      path.getPointAt(euclidMod(s + 0.004, 1), ahead);
      side.subVectors(ahead, at).cross(UP).normalize();

      const weave = (phase * braidCycles + fish.swingPhase) * Math.PI * 2;
      const swing = Math.sin(weave) * braidLateral;
      const bob = Math.sin((phase * braidCycles * 0.5 + fish.bobPhase) * Math.PI * 2) * braidVertical;
      at.addScaledVector(side, fish.lateral + swing);
      at.y += bob;

      dummy.position.copy(at);
      const pitch = Math.atan2(ahead.y - at.y + bob, Math.hypot(ahead.x - at.x, ahead.z - at.z));
      dummy.rotation.set(0, Math.atan2(ahead.x - at.x, ahead.z - at.z), 0);
      dummy.rotateX(-pitch * 0.8);
      // Banks into the swing: a fish weaving across the body is, at that
      // moment, dropping its inside shoulder (the community's own move).
      dummy.rotateZ(-Math.cos(weave) * 0.3);
      dummy.scale.setScalar(fish.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    glintUpdate?.(phase);
  };

  // Pose once so the first frame is a shoal — and so the bounding sphere
  // below is computed off REAL matrices (the sill-stones trap).
  update(0);
  mesh.computeBoundingSphere();

  return {
    group,
    draws,
    triangles,
    update,
    dispose(): void {
      for (const owned of geometries) {
        owned.dispose();
      }
      for (const owned of materials) {
        owned.dispose();
      }
      mesh.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
