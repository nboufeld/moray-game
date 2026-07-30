import type { KitDemoRegistry } from "./KitTypes";

/**
 * Package B's demo registrations (spec §4): one entry per life/light/
 * particulate piece, keyed by the piece's canonical name. A piece with
 * no demo capture may not be consumed by Phase 3 (MASTER §3). Owned by
 * the Package B worker; Package A never edits this file.
 */
export const KIT_DEMOS_B: KitDemoRegistry = {};
