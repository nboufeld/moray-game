import { describe, expect, it } from "vitest";
import {
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  type FogExp2,
} from "three";
import { CausticsSystem } from "../src/rendering/CausticsSystem";
import { LightShafts } from "../src/rendering/LightShafts";
import { Lighting, SUN_POSITION } from "../src/rendering/Lighting";
import { UnderwaterFog } from "../src/rendering/UnderwaterFog";
import {
  IDENTITY_CHANNELS,
  WEATHER_MOODS,
  WeatherMoods,
  type WeatherChannels,
} from "../src/rendering/WeatherMoods";
import { ABYSS_DEN, ABYSS_FOG, ABYSS_LIGHT, abyssMood } from "../src/world/Abyss";

/**
 * The sky's slow moods (W-M1), and above all the contract the whole package
 * ships on: the weather is a *time-based* modulation that is exactly identity
 * for the whole opening stretch of every dive — and always, in anything that
 * never attached it — so every canonical capture and every abyss-biome
 * verbatim-base assertion renders through arithmetic the weather never
 * touches. Alongside it: the schedule is a pure function of SEEDS.weather,
 * the blend maths is bounded, and the composition with W-M3's place-based
 * mood is one application of each channel to one base, never two writers.
 */

const SPAWN = new Vector3(0, 2, 22);
const CANYON_FLOOR = new Vector3(ABYSS_DEN.x, -6.5, ABYSS_DEN.z);

/** A camera-shaped argument for the scene hooks, as `abyssBiome.test.ts` does. */
function invokeSceneHook(scene: Scene, position: Vector3): void {
  const camera = new PerspectiveCamera();
  camera.position.copy(position);
  (scene.onBeforeRender as (...args: unknown[]) => void)(null, scene, camera, null);
}

function mood(id: string): Readonly<WeatherChannels> {
  const found = WEATHER_MOODS.find((candidate) => candidate.id === id);
  expect(found, id).toBeDefined();
  return (found as { channels: Readonly<WeatherChannels> }).channels;
}

/** Every MeshBasicMaterial under a group, in traversal order. */
function materialsOf(root: { traverse: (fn: (o: unknown) => void) => void }): MeshBasicMaterial[] {
  const materials: MeshBasicMaterial[] = [];
  root.traverse((object) => {
    const material = (object as { material?: unknown }).material;
    if (material instanceof MeshBasicMaterial) {
      materials.push(material);
    }
  });
  return materials;
}

describe("identity at the default mood", () => {
  it("holds bright noon, exactly, for the whole opening stretch", () => {
    const weather = new WeatherMoods();
    // 149 s at frame rate: past every capture, every settle and every e2e
    // assertion, and still inside the 150 s floor of the opening hold's draw.
    for (let i = 0; i < 149 * 60; i++) {
      weather.update(1 / 60);
    }
    expect(weather.isIdentity).toBe(true);
    expect(weather.state.mood).toBe("bright-noon");
    expect(weather.state.into).toBeNull();
    for (const key of Object.keys(IDENTITY_CHANNELS) as (keyof WeatherChannels)[]) {
      expect(weather.channels[key], key).toBe(1);
    }
  });

  it("writes the base fog back verbatim with the weather attached and quiet", () => {
    const scene = new Scene();
    const fog = new UnderwaterFog();
    const weather = new WeatherMoods();
    fog.attachWeather(weather);
    fog.applyTo(scene);
    const state = scene.fog as FogExp2;
    const baseColor = state.color.getHex();
    const baseDensity = state.density;

    for (let i = 0; i < 90 * 60; i++) {
      weather.update(1 / 60);
    }
    invokeSceneHook(scene, SPAWN);
    expect(state.color.getHex()).toBe(baseColor);
    expect(state.density).toBe(baseDensity);
    expect(scene.backgroundIntensity).toBe(1);
  });

  it("leaves the light rig at its shipped levels and colour", () => {
    const scene = new Scene();
    const lighting = new Lighting();
    const weather = new WeatherMoods();
    lighting.attachWeather(weather);
    lighting.addTo(scene);
    const baseSun = lighting.sun.intensity;
    const baseColor = lighting.sun.color.getHex();

    invokeSceneHook(scene, SPAWN);
    expect(lighting.sun.intensity).toBe(baseSun);
    expect(lighting.sun.color.getHex()).toBe(baseColor);
  });

  it("drives the shafts and caustics exactly as an unattached control", () => {
    const weather = new WeatherMoods();

    const controlShafts = new LightShafts(SUN_POSITION);
    const attachedShafts = new LightShafts(SUN_POSITION);
    attachedShafts.attachWeather(weather);
    controlShafts.update(0.4, false, SPAWN);
    attachedShafts.update(0.4, false, SPAWN);
    const controlMaterials = materialsOf(controlShafts.group);
    const attachedMaterials = materialsOf(attachedShafts.group);
    expect(attachedMaterials.length).toBe(controlMaterials.length);
    expect(attachedMaterials.length).toBeGreaterThan(0);
    for (const [index, material] of attachedMaterials.entries()) {
      expect(material.opacity).toBe(controlMaterials[index]?.opacity);
      expect(material.color.getHex()).toBe(controlMaterials[index]?.color.getHex());
    }

    const controlCaustics = new CausticsSystem();
    const attachedCaustics = new CausticsSystem();
    attachedCaustics.attachWeather(weather);
    controlCaustics.update(0.7, false);
    attachedCaustics.update(0.7, false);
    const controlLayers = materialsOf(controlCaustics.mesh);
    const attachedLayers = materialsOf(attachedCaustics.mesh);
    expect(attachedLayers.length).toBe(controlLayers.length);
    for (const [index, material] of attachedLayers.entries()) {
      expect(material.opacity).toBe(controlLayers[index]?.opacity);
    }
  });
});

describe("the schedule is a pure function of SEEDS.weather", () => {
  /** Drives a fresh instance to each checkpoint with a fixed frame delta. */
  function sample(dt: number, checkpoints: readonly number[]) {
    const weather = new WeatherMoods();
    const states = [];
    let time = 0;
    for (const target of checkpoints) {
      while (time + dt <= target + 1e-9) {
        weather.update(dt);
        time += dt;
      }
      if (target - time > 1e-9) {
        weather.update(target - time);
        time = target;
      }
      states.push(weather.state);
    }
    return states;
  }

  it("draws the same weather however the frame deltas arrive", () => {
    const checkpoints = [60, 149, 230, 420, 700, 1100, 1750];
    const fine = sample(1 / 60, checkpoints);
    const coarse = sample(0.25, checkpoints);
    for (const [index, state] of fine.entries()) {
      const other = coarse[index];
      expect(other?.mood, `checkpoint ${checkpoints[index]}`).toBe(state.mood);
      expect(other?.into, `checkpoint ${checkpoints[index]}`).toBe(state.into);
      expect(other?.blend).toBeCloseTo(state.blend, 6);
    }
  });

  it("cycles the moods with fades that never lead back into themselves", () => {
    const weather = new WeatherMoods();
    const moodsSeen = new Set<string>();
    let fadesSeen = 0;
    let lastFade = "";
    for (let second = 0; second < 3600; second++) {
      weather.update(1);
      const state = weather.state;
      moodsSeen.add(state.mood);
      if (state.into !== null) {
        expect(state.into).not.toBe(state.mood);
        expect(state.blend).toBeGreaterThanOrEqual(0);
        expect(state.blend).toBeLessThanOrEqual(1);
        const fade = `${state.mood}->${state.into}`;
        if (fade !== lastFade) {
          fadesSeen++;
          lastFade = fade;
        }
      }
    }
    // An hour holds at least ten transitions at the schedule's longest draws
    // (210 opening + n × (60 fade + 240 hold)), and the reef keeps returning
    // to noon rather than leaving it behind.
    expect(fadesSeen).toBeGreaterThanOrEqual(10);
    expect(moodsSeen.size).toBeGreaterThanOrEqual(3);
    expect(moodsSeen.has("bright-noon")).toBe(true);
  });

  it("clamps a tab-sleep delta to one second instead of jumping a whole mood", () => {
    const weather = new WeatherMoods();
    weather.update(3600);
    expect(weather.state.time).toBe(1);
    expect(weather.isIdentity).toBe(true);
  });
});

describe("the blend maths", () => {
  it("pins between the endpoints, clamped, and monotone along the blend", () => {
    const weather = new WeatherMoods();
    const noon = IDENTITY_CHANNELS;
    const haze = mood("plankton-haze");
    let lastDensity = 0;
    for (const blend of [0, 0.25, 0.5, 0.75, 1]) {
      weather.setMood("plankton-haze", blend);
      const channels = weather.channels;
      for (const key of Object.keys(noon) as (keyof WeatherChannels)[]) {
        const low = Math.min(noon[key], haze[key]);
        const high = Math.max(noon[key], haze[key]);
        expect(channels[key], `${key} at ${blend}`).toBeGreaterThanOrEqual(low);
        expect(channels[key], `${key} at ${blend}`).toBeLessThanOrEqual(high);
      }
      expect(channels.fogDensity).toBeGreaterThanOrEqual(lastDensity);
      lastDensity = channels.fogDensity;
    }

    // Ends exact: blend 1 is the mood's own table, blend 0 is identity.
    weather.setMood("plankton-haze", 1);
    expect(weather.channels.fogDensity).toBe(haze.fogDensity);
    weather.setMood("plankton-haze", 0);
    expect(weather.isIdentity).toBe(true);

    // Out-of-range blends clamp rather than extrapolate.
    weather.setMood("plankton-haze", 3);
    expect(weather.channels.fogDensity).toBe(haze.fogDensity);
    weather.setMood("plankton-haze", -2);
    expect(weather.isIdentity).toBe(true);
  });

  it("ignores an unknown mood the way the asset library ignores a missing file", () => {
    const weather = new WeatherMoods();
    weather.setMood("golden-afternoon", 1);
    weather.setMood("hurricane");
    expect(weather.state.mood).toBe("golden-afternoon");
    expect(weather.state.pinned).toBe(true);
  });

  it("resumes the schedule from the clock when unpinned", () => {
    const weather = new WeatherMoods();
    weather.setMood("overcast-drift", 1);
    for (let i = 0; i < 60; i++) {
      weather.update(1);
    }
    // Pinned: the schedule cannot write over the QA door.
    expect(weather.state.mood).toBe("overcast-drift");
    weather.setMood(null);
    // 60 s in is still the opening hold, so the schedule says noon.
    expect(weather.state.mood).toBe("bright-noon");
    expect(weather.isIdentity).toBe(true);
  });
});

describe("composition with the abyss twilight", () => {
  it("scales the fog's base and lets the twilight modulate the scaled base", () => {
    const scene = new Scene();
    const fog = new UnderwaterFog();
    const weather = new WeatherMoods();
    fog.attachWeather(weather);
    fog.applyTo(scene);
    const state = scene.fog as FogExp2;
    const base = state.color.clone();
    const baseDensity = state.density;

    weather.setMood("golden-afternoon", 1);
    const w = mood("golden-afternoon");

    // In the bowl the weather acts alone: exactly the scaled base.
    invokeSceneHook(scene, SPAWN);
    expect(state.color.r).toBe(base.r * w.fogRed);
    expect(state.color.g).toBe(base.g * w.fogGreen);
    expect(state.color.b).toBe(base.b * w.fogBlue);
    expect(state.density).toBe(baseDensity * w.fogDensity);
    expect(scene.backgroundIntensity).toBe(w.backdrop);

    // On the canyon floor the twilight applies to the weather-scaled base —
    // one composition, computed here from the two systems' published tables,
    // so a double application on either side cannot hide.
    const depth = abyssMood(CANYON_FLOOR.x, CANYON_FLOOR.y, CANYON_FLOOR.z);
    expect(depth).toBeGreaterThan(0.9);
    invokeSceneHook(scene, CANYON_FLOOR);
    const [sr, sg, sb] = ABYSS_FOG.colorScale;
    const scaled = [base.r * w.fogRed, base.g * w.fogGreen, base.b * w.fogBlue] as const;
    expect(state.color.r).toBeCloseTo(scaled[0] * (1 - depth) + scaled[0] * sr * depth, 12);
    expect(state.color.g).toBeCloseTo(scaled[1] * (1 - depth) + scaled[1] * sg * depth, 12);
    expect(state.color.b).toBeCloseTo(scaled[2] * (1 - depth) + scaled[2] * sb * depth, 12);
    expect(state.density).toBeCloseTo(
      baseDensity * w.fogDensity + ABYSS_FOG.densityGain * depth,
      12,
    );
    expect(scene.backgroundIntensity).toBeCloseTo(
      w.backdrop * (1 - ABYSS_FOG.backdropFade * depth),
      12,
    );

    // The hook is idempotent: rendering the same frame twice writes the same
    // water, which is what "no fighting" means at the pixel.
    const colorOnce = state.color.getHex();
    const densityOnce = state.density;
    invokeSceneHook(scene, CANYON_FLOOR);
    expect(state.color.getHex()).toBe(colorOnce);
    expect(state.density).toBe(densityOnce);

    // And back at noon the shipped base returns verbatim — the same invariant
    // tests/abyssBiome.test.ts holds without a weather attached at all.
    weather.setMood("bright-noon");
    invokeSceneHook(scene, SPAWN);
    expect(state.color.getHex()).toBe(base.getHex());
    expect(state.density).toBe(baseDensity);
    expect(scene.backgroundIntensity).toBe(1);
  });

  it("scales the light rig and lets the twilight take its share of the scaled key", () => {
    const scene = new Scene();
    const lighting = new Lighting();
    const weather = new WeatherMoods();
    lighting.attachWeather(weather);
    lighting.addTo(scene);
    const baseSun = lighting.sun.intensity;
    const baseColor = lighting.sun.color.getHex();

    weather.setMood("overcast-drift", 1);
    const w = mood("overcast-drift");

    invokeSceneHook(scene, SPAWN);
    expect(lighting.sun.intensity).toBe(baseSun * w.sun);

    const depth = abyssMood(CANYON_FLOOR.x, CANYON_FLOOR.y, CANYON_FLOOR.z);
    invokeSceneHook(scene, CANYON_FLOOR);
    expect(lighting.sun.intensity).toBeCloseTo(
      baseSun * w.sun * (1 - ABYSS_LIGHT.sun * depth),
      12,
    );

    // The key wears the mood's colour while it is on, and the shipped colour
    // — to the bit — the frame after the weather stands down.
    weather.setMood("golden-afternoon", 1);
    invokeSceneHook(scene, SPAWN);
    expect(lighting.sun.color.getHex()).not.toBe(baseColor);
    weather.setMood("bright-noon");
    invokeSceneHook(scene, SPAWN);
    expect(lighting.sun.color.getHex()).toBe(baseColor);
    expect(lighting.sun.intensity).toBe(baseSun);
  });

  it("tints the shafts while a mood is on and hands back the shipped materials after", () => {
    const weather = new WeatherMoods();
    const shafts = new LightShafts(SUN_POSITION);
    shafts.attachWeather(weather);
    const materials = materialsOf(shafts.group);
    const baseColors = materials.map((material) => material.color.getHex());

    weather.setMood("golden-afternoon", 1);
    shafts.update(0.5, false, SPAWN);
    expect(
      materials.some((material, index) => material.color.getHex() !== baseColors[index]),
    ).toBe(true);

    weather.setMood("bright-noon");
    shafts.update(0.5, false, SPAWN);
    for (const [index, material] of materials.entries()) {
      expect(material.color.getHex()).toBe(baseColors[index]);
    }
  });

  it("dims the caustics by exactly the mood's own gain", () => {
    const weather = new WeatherMoods();
    const control = new CausticsSystem();
    const attached = new CausticsSystem();
    attached.attachWeather(weather);
    weather.setMood("overcast-drift", 1);
    control.update(0.7, false);
    attached.update(0.7, false);
    const gain = mood("overcast-drift").caustics;
    const controlLayers = materialsOf(control.mesh);
    const attachedLayers = materialsOf(attached.mesh);
    for (const [index, material] of attachedLayers.entries()) {
      expect(material.opacity).toBe((controlLayers[index]?.opacity ?? 0) * gain);
    }
  });
});

describe("the behavioural channels (W-N4)", () => {
  it("authors the moods inside the value key's guardrails", () => {
    for (const { id, channels } of WEATHER_MOODS) {
      // Read the red channel first: no mood may cut the fog's red hard —
      // the shipped base carries 83 parts and the tone curve's crush lives
      // below ~28, so 0.9 is a wide, deliberate floor.
      expect(channels.fogRed, id).toBeGreaterThanOrEqual(0.9);
      // The fog only ever brightens or holds against darkness-by-distance:
      // a mood may not send the water toward black.
      for (const key of Object.keys(IDENTITY_CHANNELS) as (keyof WeatherChannels)[]) {
        expect(channels[key], `${id}.${key}`).toBeGreaterThanOrEqual(0);
      }
    }
    // Warmth arrives red-up, never green-down (the electric-cyan trap).
    const golden = mood("golden-afternoon");
    expect(golden.fogRed).toBeGreaterThan(1);
    expect(golden.fogBlue).toBeLessThan(golden.fogRed);
  });

  it("a full overcast hides the shafts, pools and dapples entirely", () => {
    const weather = new WeatherMoods();
    weather.setMood("overcast-drift", 1);
    expect(mood("overcast-drift").shaftOpacity).toBe(0);
    expect(mood("overcast-drift").caustics).toBe(0);

    const shafts = new LightShafts(SUN_POSITION);
    shafts.attachWeather(weather);
    shafts.update(0.4, false, SPAWN);
    for (const material of materialsOf(shafts.group)) {
      expect(material.opacity).toBe(0);
      expect(material.visible).toBe(false);
    }

    const caustics = new CausticsSystem();
    caustics.attachWeather(weather);
    caustics.update(0.4, false);
    for (const material of materialsOf(caustics.mesh)) {
      expect(material.opacity).toBe(0);
      expect(material.visible).toBe(false);
    }

    // And identity hands the shipped materials back, visible again.
    weather.setMood("bright-noon");
    shafts.update(0.4, false, SPAWN);
    caustics.update(0.4, false);
    for (const material of [...materialsOf(shafts.group), ...materialsOf(caustics.mesh)]) {
      expect(material.visible).toBe(true);
      expect(material.opacity).toBeGreaterThan(0);
    }
  });

  it("keeps everything visible mid-crossfade, so the hide can never pop", () => {
    const weather = new WeatherMoods();
    weather.setMood("overcast-drift", 0.5);
    const shafts = new LightShafts(SUN_POSITION);
    shafts.attachWeather(weather);
    shafts.update(0.4, false);
    const caustics = new CausticsSystem();
    caustics.attachWeather(weather);
    caustics.update(0.4, false);
    for (const material of [...materialsOf(shafts.group), ...materialsOf(caustics.mesh)]) {
      expect(material.visible).toBe(true);
      expect(material.opacity).toBeGreaterThan(0);
    }
  });

  it("lands the mood's light tint on the dapples as well as the beams", () => {
    const weather = new WeatherMoods();
    const caustics = new CausticsSystem();
    caustics.attachWeather(weather);
    const layers = materialsOf(caustics.mesh);
    const golden = mood("golden-afternoon");

    weather.setMood("golden-afternoon", 1);
    caustics.update(0.4, false);
    for (const material of layers) {
      expect(material.color.r).toBe(golden.shaftRed);
      expect(material.color.g).toBe(golden.shaftGreen);
      expect(material.color.b).toBe(golden.shaftBlue);
    }

    weather.setMood("bright-noon");
    caustics.update(0.4, false);
    for (const material of layers) {
      expect(material.color.getHex()).toBe(0xffffff);
    }
  });
});
