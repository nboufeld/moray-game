import type { KitDemoRegistry } from "./KitTypes";

/**
 * Package A's demo registrations (spec §4): one entry per ground/flora
 * piece, keyed by the piece's canonical name. A piece with no demo
 * capture may not be consumed by Phase 3 (MASTER §3). Owned by the
 * Package A worker; Package B never edits this file.
 */
export const KIT_DEMOS_A: KitDemoRegistry = {};
