import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { DEFAULT_FOCUS_PARAMS, FocusScanner } from "../src/discovery/FocusScanner";

const camera = new Vector3(0, 0, 0);
const forward = new Vector3(0, 0, -1);
const target = new Vector3(0, 0, -5);

describe("FocusScanner", () => {
  it("completes when the target is centred, in range and unobstructed", () => {
    const scanner = new FocusScanner();
    let completed = false;
    for (let i = 0; i < 200 && !completed; i++) {
      const state = scanner.update(
        { cameraPosition: camera, forward, targetPosition: target, obstructed: false },
        1 / 60,
      );
      completed = state.completed;
    }
    expect(completed).toBe(true);
    expect(scanner.isCompleted()).toBe(true);
  });

  it("fires justCompleted exactly once", () => {
    const scanner = new FocusScanner();
    let fires = 0;
    for (let i = 0; i < 200; i++) {
      const state = scanner.update(
        { cameraPosition: camera, forward, targetPosition: target, obstructed: false },
        1 / 60,
      );
      if (state.justCompleted) {
        fires++;
      }
    }
    expect(fires).toBe(1);
  });

  it("does not progress when the target is off-angle", () => {
    const scanner = new FocusScanner();
    const offTarget = new Vector3(5, 0, -1); // far to the side
    let progress = 0;
    for (let i = 0; i < 60; i++) {
      progress = scanner.update(
        { cameraPosition: camera, forward, targetPosition: offTarget, obstructed: false },
        1 / 60,
      ).progress;
    }
    expect(progress).toBe(0);
  });

  it("does not progress when obstructed", () => {
    const scanner = new FocusScanner();
    let progress = 0;
    for (let i = 0; i < 120; i++) {
      progress = scanner.update(
        { cameraPosition: camera, forward, targetPosition: target, obstructed: true },
        1 / 60,
      ).progress;
    }
    expect(progress).toBe(0);
  });

  it("decays progress when alignment is lost", () => {
    const scanner = new FocusScanner();
    for (let i = 0; i < 30; i++) {
      scanner.update({ cameraPosition: camera, forward, targetPosition: target, obstructed: false }, 1 / 60);
    }
    const before = scanner.update(
      { cameraPosition: camera, forward, targetPosition: target, obstructed: false },
      0,
    ).progress;
    const after = scanner.update(
      { cameraPosition: camera, forward, targetPosition: target, obstructed: true },
      0.5,
    ).progress;
    expect(after).toBeLessThan(before);
  });

  it("decays progress for a step in which it was not scanned at all", () => {
    const scanner = new FocusScanner();
    for (let i = 0; i < 30; i++) {
      scanner.update({ cameraPosition: camera, forward, targetPosition: target, obstructed: false }, 1 / 60);
    }
    const before = scanner.decay(0).progress;
    const after = scanner.decay(0.5).progress;
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(0);
  });

  it("leaves a completed scanner completed when it decays", () => {
    const scanner = new FocusScanner();
    for (let i = 0; i < 200; i++) {
      scanner.update({ cameraPosition: camera, forward, targetPosition: target, obstructed: false }, 1 / 60);
    }
    expect(scanner.isCompleted()).toBe(true);

    const state = scanner.decay(5);
    expect(state.completed).toBe(true);
    expect(state.progress).toBe(1);
  });

  it("rejects targets beyond max distance", () => {
    const scanner = new FocusScanner();
    const farTarget = new Vector3(0, 0, -(DEFAULT_FOCUS_PARAMS.maxDistance + 5));
    const state = scanner.update(
      { cameraPosition: camera, forward, targetPosition: farTarget, obstructed: false },
      1 / 60,
    );
    expect(state.aligned).toBe(false);
  });
});
