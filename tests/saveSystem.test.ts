import { describe, expect, it } from "vitest";
import { SaveSystem, type StorageLike } from "../src/save/SaveSystem";
import { CURRENT_SAVE_VERSION, migrate } from "../src/save/SaveMigration";

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe("migrate", () => {
  it("returns an empty save for null/undefined", () => {
    expect(migrate(null).discovered).toEqual([]);
    expect(migrate(undefined).version).toBe(CURRENT_SAVE_VERSION);
  });

  it("upgrades a legacy v0 bare array of ids", () => {
    const result = migrate(["snowflake-moray", "zebra-moray"]);
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.discovered).toEqual(["snowflake-moray", "zebra-moray"]);
    expect(result.settings).toEqual({});
  });

  it("upgrades a v1 object while preserving settings", () => {
    const result = migrate({
      version: 1,
      discovered: ["ribbon-moray"],
      settings: { reducedMotion: true, fieldOfView: 66 },
    });
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.discovered).toEqual(["ribbon-moray"]);
    expect(result.settings).toEqual({ reducedMotion: true, fieldOfView: 66 });
  });

  it("keeps a saved sound volume, and leaves older saves without one alone", () => {
    const withVolume = migrate({ version: 2, discovered: [], settings: { soundVolume: 0.25 } });
    expect(withVolume.settings.soundVolume).toBe(0.25);

    // A save written before the soundscape existed simply has no opinion on
    // the level, and must fall through to the default rather than to zero.
    const legacy = migrate({ version: 1, discovered: [], settings: { fieldOfView: 66 } });
    expect("soundVolume" in legacy.settings).toBe(false);
  });

  it("drops a corrupt sound volume rather than passing NaN to a gain node", () => {
    const result = migrate({
      version: 2,
      discovered: [],
      settings: { soundVolume: "loud", reducedMotion: true },
    });
    expect(result.settings).toEqual({ reducedMotion: true });
  });

  it("preserves accessibility settings across a content-only migration", () => {
    // A future/unknown version tag must not drop the player's settings.
    const result = migrate({ version: 999, discovered: [], settings: { autoLevel: true } });
    expect(result.settings.autoLevel).toBe(true);
  });

  it("discards corrupt id and settings shapes safely", () => {
    const result = migrate({ version: 1, discovered: [1, "ok", null], settings: 42 });
    expect(result.discovered).toEqual(["ok"]);
    expect(result.settings).toEqual({});
  });

  it("drops wrong-typed settings fields but keeps the valid ones", () => {
    // fieldOfView reaches camera.fov directly, so a string there would render
    // a NaN projection matrix the player cannot recover from in-game.
    const result = migrate({
      version: 2,
      discovered: [],
      settings: {
        fieldOfView: "wide",
        lookSensitivity: Number.NaN,
        cameraBob: "yes",
        reducedMotion: true,
        unknownOption: 5,
      },
    });

    expect(result.settings).toEqual({ reducedMotion: true });
  });
});

describe("SaveSystem", () => {
  it("records discoveries idempotently and persists them", () => {
    const storage = new MemoryStorage();
    const save = new SaveSystem(storage);

    save.recordDiscovery("snowflake-moray", {});
    save.recordDiscovery("snowflake-moray", {});
    save.recordDiscovery("zebra-moray", { reducedMotion: true });

    const reloaded = new SaveSystem(storage).load();
    expect(reloaded.discovered).toEqual(["snowflake-moray", "zebra-moray"]);
    expect(reloaded.settings.reducedMotion).toBe(true);
  });

  it("merges settings without losing discoveries", () => {
    const storage = new MemoryStorage();
    const save = new SaveSystem(storage);
    save.recordDiscovery("ribbon-moray", {});
    save.saveSettings({ fieldOfView: 80 });

    const reloaded = save.load();
    expect(reloaded.discovered).toEqual(["ribbon-moray"]);
    expect(reloaded.settings.fieldOfView).toBe(80);
  });

  it("clears saved data", () => {
    const storage = new MemoryStorage();
    const save = new SaveSystem(storage);
    save.recordDiscovery("dragon-moray", {});
    save.clear();
    expect(save.load().discovered).toEqual([]);
  });

  it("returns an empty save when storage is unavailable", () => {
    const save = new SaveSystem(null);
    expect(save.load().discovered).toEqual([]);
    // Must not throw.
    save.recordDiscovery("snowflake-moray", {});
  });
});
