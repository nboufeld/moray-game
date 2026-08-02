import { Color, type DataTexture } from "three";
import {
  buildColorTexture,
  buildNormalTexture,
  fbm,
  voronoi,
} from "../../rendering/ProceduralTexture";
import type { MoraySpeciesConfig } from "./MoraySpeciesConfig";

/**
 * 256 rather than 512: these are generated at construction time and the unit
 * tests build every species, so the cost is paid on a hot path.
 */
const SIZE = 256;

export interface MoraySkin {
  readonly map: DataTexture;
  readonly normalMap: DataTexture;
}

/**
 * The markings and skin of one species, painted across the whole body.
 *
 * There used to be a third map here, a broken roughness that stood for a wet
 * animal's specular. Ramp shading has no specular to break, so it went with the
 * BRDF: what makes the eel read as an animal now is the counter-shading below
 * and the folds in the normal map, both of which survive a stepped light.
 *
 * The body's UVs run `u` around the circumference and `v` from head to tail, so
 * this paints in animal space: `u` carries the dorsal-ventral gradient that
 * every real fish has (dark back, pale belly) and `v` carries the markings
 * flowing down the length. That counter-shading is doing as much work as the
 * pattern itself — it is what stops the eel reading as a coloured pipe.
 *
 * Built as `DataTexture`, so unlike the canvas version this replaced it needs
 * no DOM and works unchanged in the Node unit tests.
 */
const cache = new Map<string, MoraySkin>();

export function createMoraySkin(config: MoraySpeciesConfig): MoraySkin {
  const cached = cache.get(config.id);
  if (cached) {
    return cached;
  }

  const body = new Color(config.bodyColor);
  const pattern = new Color(config.patternColor);
  const seed = hashId(config.id);

  const skin: MoraySkin = {
    map: buildColorTexture(SIZE, (u, v) => {
      // u = 0 is the belly and u = 0.5 the spine, given how the body tubes are
      // built and rotated.
      const dorsal = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
      const marking = markingMask(config, u, v, seed);

      // Counter-shading: back toward shadow, belly lifted toward pale — and
      // half the range it used to run, lifted so the back is no longer in
      // shadow at all.
      //
      // This map is what a moray wears when there is no painted skin on disk,
      // and that is the whole reason for the change. A range of 0.72 to 1.22 is
      // a photographic animal: it models the light falling on a cylinder, on
      // top of a ramp that is already modelling the light falling on a
      // cylinder, and the two together give the eel a dark back it never
      // recovers from. A painted one has counter-shading as a *marking* — a
      // pale belly the illustrator drew — which is what a narrower band around
      // the body colour reads as.
      const shade = 0.86 + (1 - dorsal) * 0.28;
      const r = body.r * shade;
      const g = body.g * shade;
      const b = body.b * shade;

      // The marking never quite reaches its own colour. A mask that lands on 1
      // is a printed edge, and every one of these species is described in the
      // codex as painted — dusted, wrapped, ornate. Nine tenths keeps the
      // pattern's shape and takes the print off it.
      const ink = marking * 0.9;
      return [r + (pattern.r - r) * ink, g + (pattern.g - g) * ink, b + (pattern.b - b) * ink];
    }),

    // Fine skin wrinkles, tightening toward the head where the folds gather.
    normalMap: buildNormalTexture(
      SIZE,
      (u, v) => {
        const folds = fbm(u, v * 2.4, { seed: seed ^ 0x51, period: 26, octaves: 3 });
        const nearHead = Math.pow(1 - v, 2);
        return folds * (0.55 + nearHead * 0.85);
      },
      0.035,
    ),
  };

  cache.set(config.id, skin);
  return skin;
}

/** 0 where the body colour shows, 1 where the marking colour does. */
function markingMask(config: MoraySpeciesConfig, u: number, v: number, seed: number): number {
  switch (config.pattern) {
    case "spots": {
      // Clustered rosettes rather than dots: cell interiors speckled, walls clear.
      const { f1 } = voronoi(u, v * 3, 9, seed);
      const warp = fbm(u * 3, v * 6, { seed: seed ^ 0x2b, period: 18, octaves: 3 });
      const rosette = 1 - Math.min(1, f1 / 0.055);
      return clamp01((rosette * 0.9 + (warp - 0.55) * 0.9) * 1.4);
    }
    case "bands": {
      // Bars wrapping the body, with irregular edges so they read as an animal
      // rather than as a set of printed rings.
      const wobble = (fbm(u * 2, v * 4, { seed: seed ^ 0x3d, period: 10, octaves: 3 }) - 0.5) * 0.06;
      const along = v + wobble;
      const wave = Math.sin(along * Math.PI * 2 * 13);
      return clamp01((wave - 0.05) * 6);
    }
    case "plain": {
      // No markings; a faint lengthwise mottle keeps it from looking printed.
      return clamp01((fbm(u, v * 2, { seed, period: 8, octaves: 3 }) - 0.62) * 1.2);
    }
    case "speckle": {
      // Small pale points on a dark ground — the abyssal moray's night-sky
      // dusting (W-M3). A voronoi cell centre makes a dot; a low-frequency
      // gate collects the dots into loose drifts, because an even field of
      // specks is a print and an animal's markings pool and thin. The dots
      // are far smaller than the spots pattern's rosettes and never merge:
      // this skin reads as points of pallor, not as a pattern colour.
      const { f1 } = voronoi(u * 2, v * 5, 16, seed);
      const speck = clamp01(1 - f1 / 0.03);
      const drift = fbm(u * 2, v * 3, { seed: seed ^ 0x6d, period: 7, octaves: 2 });
      return clamp01(speck * 1.9) * clamp01((drift - 0.34) * 2.8);
    }
    default: {
      const exhaustive: never = config.pattern;
      throw new Error(`Unhandled moray pattern: ${String(exhaustive)}`);
    }
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Stable per-species seed so a given moray always wears the same markings. */
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}
