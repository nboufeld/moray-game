import {
  BufferAttribute,
  Color,
  ConeGeometry,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { applyVeinGlow, smoothstep01 } from "./Golden2Shared";
import type { CarillonBuild } from "./Golden2Carillon";

/**
 * THE BELL RINGER — the region's findable resident.
 *
 * An ancient chambered nautilus that lives in the Belfry's hollow crown
 * and keeps the Carillon's hours: it rises out of the bell mouth on a
 * slow breath — up into the open water above the towers — hangs there a
 * moment like a struck note, and sinks home. The gold spiral of its
 * shell is painted with the vein-glow material, so in the honey water
 * the Ringer reads as a slow amber lantern climbing out of a stone
 * bell; findable from the whole Pavement.
 *
 * One merged mesh (shell, hood, tentacle skirt) posed whole along its
 * closed-form breath; the update spends no randomness — captures
 * settle deterministically.
 */

const SEED = SEEDS.regionGolden2;

export const NAUTILUS_SPECIES_ID = "carillon-nautilus";

/** One full breath — rise, hang, sink, rest — in seconds. */
const BREATH_SECONDS = 46;
/** How far above the bell mouth the rise crests, metres. */
const RISE = 7.5;

export interface NautilusBuild {
  readonly meshes: Mesh[];
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildNautilus(carillon: CarillonBuild): NautilusBuild {
  const random = new Random(SEED ^ 0x0ee1);
  const phase = random.range(0, Math.PI * 2);
  const mouth = carillon.bellMouth;

  const geometry = buildNautilusBody();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xf0c060,
    emissiveIntensity: 1.0,
  });
  applyVeinGlow(material, "carillon-nautilus");
  // The lantern is fog-free (the Keeper's own lesson): the honey mood
  // would wash the glow to nothing past ~35 m, and a resident that
  // cannot be seen from the Pavement is not findable.
  material.fog = false;
  const mesh = new Mesh(geometry, material);
  mesh.name = "carillon-nautilus";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // The breath never leaves the Belfry's own column; one honest sphere.
  mesh.frustumCulled = false;

  // The discovery target hangs over the bell mouth, where the rise
  // crests — visible from the whole Pavement and the belfry pose.
  const target: DiscoveryTarget = {
    speciesId: NAUTILUS_SPECIES_ID,
    position: new Vector3(mouth.x, mouth.y + RISE * 0.7, mouth.z),
  };

  const pose = (time: number): void => {
    const t = ((time / BREATH_SECONDS + phase / (Math.PI * 2)) % 1 + 1) % 1;
    // The breath: rest in the bell (t 0–0.2), rise (0.2–0.5), hang
    // (0.5–0.7), sink (0.7–1). Smooth by construction.
    const up =
      smoothstep01((t - 0.2) / 0.3) * (1 - smoothstep01((t - 0.68) / 0.28));
    const y = mouth.y - 2.6 + up * (RISE + 2.6);
    // A slow drift circle while risen — the clapper swinging.
    const swing = up * 1.6;
    const angle = time * 0.24 + phase;
    mesh.position.set(
      mouth.x + Math.cos(angle) * swing,
      y + Math.sin(time * 0.5 + phase) * 0.3,
      mouth.z + Math.sin(angle) * swing,
    );
    // The shell rides tilted, tentacles down-current; a slow yaw.
    mesh.rotation.set(0.18 + Math.sin(time * 0.3 + phase) * 0.08, angle * 0.6, 0.1);
  };
  pose(0);

  let slowTime = 0;
  let last = 0;
  return {
    meshes: [mesh],
    target,
    update(time: number, reducedMotion: boolean): void {
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

// ─── The Ringer's body ───────────────────────────────────────────────────────

const SHELL_CREAM = new Color(0xe8d6ac);
const SHELL_AMBER = new Color(0xc09258);
const SPIRAL_GOLD = new Color(0xf4d488);
const HOOD_VIOLET = new Color(0x6e5474);
const SKIRT_DUSK = new Color(0x84688a);

function buildNautilusBody(): BufferGeometry {
  const parts: BufferGeometry[] = [];

  // The shell: a squashed torus wearing a painted growth spiral — the
  // planispiral read at toon values without modelling the coil.
  const shell = new TorusGeometry(0.62, 0.5, 14, 22);
  shell.scale(1, 1, 0.72);
  smoothNormals(shell);
  {
    const position = shell.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const theta = Math.atan2(y, x);
      const r = Math.hypot(x, y);
      const t = smoothstep01((y + 1.1) / 2.2);
      shade.copy(SHELL_AMBER).lerp(SHELL_CREAM, t);
      // The growth spiral: gold bands sweeping around the coil, wider
      // toward the mouth — the desert's own hour-lines.
      const spiral = Math.max(0, Math.sin(theta * 7 + r * 2.4)) ** 6;
      shade.lerp(SPIRAL_GOLD, spiral * 0.75);
      const mottle =
        (fbm(theta * 1.4, r * 2.0, { seed: SEED ^ 0x0ee2, period: 5, octaves: 2 }) - 0.5) * 0.22;
      shade.multiplyScalar(1 + mottle);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    shell.setAttribute("color", new BufferAttribute(colors, 3));
  }
  shell.rotateY(Math.PI / 2);
  parts.push(shell.toNonIndexed());
  shell.dispose();

  // The hood: a violet dome over the shell's mouth.
  const hood = new SphereGeometry(0.42, 12, 8);
  hood.scale(1, 0.8, 1.1);
  hood.translate(0, -0.55, 0.62);
  paintFlat(hood, HOOD_VIOLET, 0.12);
  parts.push(hood.toNonIndexed());
  hood.dispose();

  // The eye ridge: a pale band across the hood.
  const ridge = new TorusGeometry(0.34, 0.08, 6, 12, Math.PI);
  ridge.rotateX(Math.PI / 2);
  ridge.translate(0, -0.42, 0.7);
  paintFlat(ridge, SHELL_CREAM, 0.08);
  parts.push(ridge.toNonIndexed());
  ridge.dispose();

  // The tentacle skirt: a fluted cone hanging below the mouth, painted
  // in dusk strands — the clapper of the bell.
  const skirt = new ConeGeometry(0.36, 0.95, 12, 4, true);
  {
    const position = skirt.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = position.getY(i);
      const theta = Math.atan2(z, x);
      const flare = 1 + Math.max(0, -y) * 0.5 + Math.sin(theta * 6) * 0.1 * Math.max(0, -y);
      position.setX(i, x * flare);
      position.setZ(i, z * flare);
    }
    position.needsUpdate = true;
  }
  skirt.rotateX(0.25);
  skirt.translate(0, -1.0, 0.55);
  {
    const position = skirt.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const theta = Math.atan2(position.getZ(i) - 0.55, position.getX(i));
      const strand = Math.max(0, Math.sin(theta * 6)) ** 2;
      shade.copy(SKIRT_DUSK).lerp(SPIRAL_GOLD, strand * 0.3);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    skirt.setAttribute("color", new BufferAttribute(colors, 3));
  }
  parts.push(skirt.toNonIndexed());
  skirt.dispose();

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("carillon nautilus parts could not be merged");
  }
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  // A spirit, not a specimen: readable as a lantern from the Pavement
  // (the Keeper's sizing lesson — a discovery needs no magnifying glass).
  merged.scale(2.1, 2.1, 2.1);
  merged.computeBoundingSphere();
  return merged;
}

/** Uniform paint with a small value mottle, for the one-tone parts. */
function paintFlat(geometry: BufferGeometry, color: Color, mottle: number): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const wave =
      (fbm(position.getX(i) * 2, position.getY(i) * 2, { seed: SEED ^ 0x0ee3, period: 4, octaves: 2 }) -
        0.5) *
      mottle *
      2;
    shade.copy(color).multiplyScalar(1 + wave);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}
