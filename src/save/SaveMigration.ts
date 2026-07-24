import type { ComfortSettings } from "../accessibility/AccessibilitySettings";

export const CURRENT_SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  discovered: string[];
  settings: Partial<ComfortSettings>;
}

export function emptySave(): SaveData {
  return { version: CURRENT_SAVE_VERSION, discovered: [], settings: {} };
}

/**
 * Upgrades any historical save shape to the current schema. Accessibility
 * settings must survive content-only changes, so unknown/older shapes never
 * throw — they degrade to the closest valid data.
 *
 * Known historical shapes:
 *  - v0: a bare array of discovered species ids (earliest prototype).
 *  - v1: `{ version: 1, discovered, settings }` — same fields, older version tag.
 *  - v2: current.
 */
export function migrate(raw: unknown): SaveData {
  if (raw == null) {
    return emptySave();
  }

  // v0 — a bare array of discovered ids.
  if (Array.isArray(raw)) {
    return { version: CURRENT_SAVE_VERSION, discovered: sanitizeIds(raw), settings: {} };
  }

  if (typeof raw !== "object") {
    return emptySave();
  }

  const record = raw as Record<string, unknown>;
  const discovered = sanitizeIds(record.discovered);
  const settings = isPlainObject(record.settings) ? (record.settings as Partial<ComfortSettings>) : {};
  const version = typeof record.version === "number" ? record.version : 0;

  switch (version) {
    case CURRENT_SAVE_VERSION:
    case 1:
    case 0:
      // All known versions share the same field semantics; we simply retag.
      return { version: CURRENT_SAVE_VERSION, discovered, settings };
    default:
      // Newer-than-known or corrupt version: keep the data we can read.
      return { version: CURRENT_SAVE_VERSION, discovered, settings };
  }
}

function sanitizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
