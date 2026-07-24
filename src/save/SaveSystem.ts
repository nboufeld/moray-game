import type { ComfortSettings } from "../accessibility/AccessibilitySettings";
import { CURRENT_SAVE_VERSION, emptySave, migrate, type SaveData } from "./SaveMigration";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DEFAULT_KEY = "reef-between-seas.save.v1";

/**
 * Persists discoveries and comfort settings behind a versioned schema. Reads
 * are always run through {@link migrate} so older or corrupt saves degrade
 * gracefully rather than losing the player's accessibility settings.
 */
export class SaveSystem {
  constructor(
    private readonly storage: StorageLike | null = safeLocalStorage(),
    private readonly key: string = DEFAULT_KEY,
  ) {}

  load(): SaveData {
    if (!this.storage) {
      return emptySave();
    }
    try {
      const raw = this.storage.getItem(this.key);
      if (raw === null) {
        return emptySave();
      }
      return migrate(JSON.parse(raw));
    } catch {
      return emptySave();
    }
  }

  save(data: SaveData): void {
    if (!this.storage) {
      return;
    }
    const payload: SaveData = {
      version: CURRENT_SAVE_VERSION,
      discovered: [...data.discovered],
      settings: { ...data.settings },
    };
    try {
      this.storage.setItem(this.key, JSON.stringify(payload));
    } catch {
      // Storage full or unavailable — non-fatal for a single-session dive.
    }
  }

  recordDiscovery(speciesId: string, settings: Partial<ComfortSettings>): SaveData {
    const current = this.load();
    if (!current.discovered.includes(speciesId)) {
      current.discovered.push(speciesId);
    }
    current.settings = { ...current.settings, ...settings };
    this.save(current);
    return current;
  }

  saveSettings(settings: Partial<ComfortSettings>): SaveData {
    const current = this.load();
    current.settings = { ...current.settings, ...settings };
    this.save(current);
    return current;
  }

  clear(): void {
    this.storage?.removeItem(this.key);
  }
}

function safeLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // Access can throw in sandboxed contexts.
  }
  return null;
}
