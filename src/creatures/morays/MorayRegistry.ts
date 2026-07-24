import { MORAY_SPECIES, type MoraySpeciesConfig } from "./MoraySpeciesConfig";

/**
 * Maps species IDs to their configuration. Kept intentionally free of any
 * Three.js dependency so it can be validated in fast unit tests.
 */
export class MorayRegistry {
  private readonly byId = new Map<string, MoraySpeciesConfig>();

  constructor(species: readonly MoraySpeciesConfig[] = MORAY_SPECIES) {
    for (const config of species) {
      if (this.byId.has(config.id)) {
        throw new Error(`Duplicate moray species id: ${config.id}`);
      }
      this.byId.set(config.id, config);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Throws during development when a required species is absent. */
  require(id: string): MoraySpeciesConfig {
    const config = this.byId.get(id);
    if (!config) {
      throw new Error(`Unknown moray species id: ${id}`);
    }
    return config;
  }

  all(): MoraySpeciesConfig[] {
    return [...this.byId.values()];
  }

  get size(): number {
    return this.byId.size;
  }
}
