import type { Group } from "three";

/**
 * Phase 2 kit — shared conventions, verbatim from docs/fill-plans/
 * KIT-SPEC.md §1 (scaffolded by the orchestrator so both packages build
 * against one truth from day one). THE LAWS (spec §1) bind every piece:
 * private seeds only, one lit door, authored value-first paint, honest
 * bounds, plain-Node determinism, doctrine budget shapes, procedural
 * fallback by construction.
 */

/** What every builder returns. Budget numbers are HONEST — counted from
 *  the meshes actually created, asserted by the kit tests. */
export interface KitBuild {
  readonly group: Group; // caller parents it; kit never touches a Scene
  readonly draws: number; // draw calls this build adds
  readonly triangles: number; // triangles this build adds
  dispose(): void; // releases ONLY what the build created
}

/** Region palettes are parameters, never baked in. Hexes are the sRGB
 *  colours a painter picked; builders convert as the bowl does. */
export interface KitPalette {
  readonly base: number;
  readonly tip?: number; // tip/crest lift (TIP_GOLD-class accents)
  readonly shade?: number; // crotch/root shade — a COLOUR, never black
  readonly accent?: number;
}

/** Density gate in [0,1] — regions pass their weight/recovery/biome
 *  functions; kit pieces never import terrain modules. */
export type GateFn = (x: number, z: number) => number;
/** World floor height — regions pass their own terrain sampler. */
export type GroundFn = (x: number, z: number) => number;

/** Where a piece scatters: a disc or a road. */
export type KitArea =
  | { center: [number, number]; radius: number }
  | { polyline: [number, number][]; width: number };

/** MASTER §4.1's random-sweep salt, one constant for every region:
 *  a sweep pose stream is `new Random(SEEDS.region<X> ^ KIT_SWEEP_SALT)`. */
export const KIT_SWEEP_SALT = 0x5a4d_5eed;

// ─── The demo harness contract (spec §4) ────────────────────────────────────

/** A staged demo: build the piece against the harness's standard stage. */
export interface KitDemoStage {
  /** The demo stage's flat-ish ground sampler (small dunes around y≈0). */
  readonly ground: GroundFn;
}

export interface KitDemo {
  /** Camera for the capture, world space. */
  readonly camera: {
    readonly position: readonly [number, number, number];
    readonly lookAt: readonly [number, number, number];
  };
  /** True for glow pieces that want the dark stage mood. */
  readonly dark?: boolean;
  /** Simulated seconds to advance closed-form motion before capture. */
  readonly timeSec?: number;
  build(stage: KitDemoStage): KitBuild;
}

/** Registered per package (spec §4): A in KitDemosA, B in KitDemosB. */
export type KitDemoRegistry = Readonly<Record<string, KitDemo>>;
