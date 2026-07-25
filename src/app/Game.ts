import { PerspectiveCamera, Raycaster, Scene, Vector3 } from "three";
import {
  CALM_MODE_SETTINGS,
  DEFAULT_SETTINGS,
  type ComfortSettings,
} from "../accessibility/AccessibilitySettings";
import { FishSchoolSystem } from "../creatures/fish/FishSchoolSystem";
import { Moray } from "../creatures/morays/Moray";
import { MorayRegistry } from "../creatures/morays/MorayRegistry";
import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";
import { DiscoverySystem, type DiscoveryTarget } from "../discovery/DiscoverySystem";
import { DiveController } from "../player/DiveController";
import { CameraRig } from "../player/CameraRig";
import { InputController } from "../player/InputController";
import { CausticsSystem } from "../rendering/CausticsSystem";
import { DiscoveryPulse } from "../rendering/DiscoveryPulse";
import { LightShafts } from "../rendering/LightShafts";
import { Lighting } from "../rendering/Lighting";
import { Particles } from "../rendering/Particles";
import { UnderwaterFog } from "../rendering/UnderwaterFog";
import { SanctuaryScene } from "../sanctuary/SanctuaryScene";
import { SaveSystem } from "../save/SaveSystem";
import { Codex } from "../ui/Codex";
import { Hud } from "../ui/Hud";
import { renderMorayPortrait } from "../ui/MorayPortrait";
import { SanctuaryOverlay } from "../ui/SanctuaryOverlay";
import { SettingsPanel } from "../ui/SettingsPanel";
import { CollisionField } from "../world/CollisionField";
import { Reef } from "../world/Reef";
import { GameLoop } from "./GameLoop";
import { RendererAdapter } from "./RendererAdapter";

const PLAYER_RADIUS = 0.6;

interface MorayInstance {
  readonly config: MoraySpeciesConfig;
  readonly moray: Moray;
  readonly target: DiscoveryTarget;
}

export interface GameOptions {
  resetSave?: boolean;
}

/** A fixed viewpoint and settle time for a reproducible screenshot. */
export interface CapturePose {
  position?: [number, number, number];
  yaw?: number;
  pitch?: number;
  /** Simulated seconds to advance from load before the frame is held. */
  settle?: number;
}

type Mode = "reef" | "sanctuary";

export class Game {
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: RendererAdapter;
  private readonly loop = new GameLoop();

  private readonly reef = new Reef();
  private readonly collision: CollisionField;
  private readonly caustics = new CausticsSystem();
  private readonly shafts: LightShafts;
  private readonly particles = new Particles();
  private readonly fish = new FishSchoolSystem();

  private readonly registry = new MorayRegistry();
  private readonly morays: MorayInstance[] = [];

  private readonly dive: DiveController;
  private readonly rig: CameraRig;
  private readonly input: InputController;

  private readonly discovery: DiscoverySystem;
  private readonly pulse = new DiscoveryPulse();
  private readonly portraitQueue: MoraySpeciesConfig[] = [];
  private readonly hud = new Hud();
  private readonly codex = new Codex();
  private readonly settingsPanel: SettingsPanel;
  private readonly sanctuary = new SanctuaryScene();
  private readonly sanctuaryOverlay = new SanctuaryOverlay();

  private readonly save: SaveSystem;
  private settings: ComfortSettings = { ...DEFAULT_SETTINGS };
  private calmActive = false;

  private readonly raycaster = new Raycaster();
  private readonly rayDir = new Vector3();
  private readonly headScratch = new Vector3();

  private mode: Mode = "reef";
  private hintLevel = -1;
  private lastTime = 0;
  private running = false;
  private holding = false;
  private moved = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: GameOptions = {},
  ) {
    this.save = new SaveSystem();
    if (options.resetSave) {
      this.save.clear();
    }
    const saved = this.save.load();
    this.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
    this.calmActive = isCalm(this.settings);

    this.camera = new PerspectiveCamera(this.settings.fieldOfView, 1, 0.1, 160);
    this.renderer = new RendererAdapter(canvas);

    new UnderwaterFog().applyTo(this.scene);
    const lighting = new Lighting();
    lighting.addTo(this.scene);
    this.shafts = new LightShafts(lighting.sun.position);
    this.shafts.addTo(this.scene);
    this.caustics.addTo(this.scene);
    this.particles.addTo(this.scene);
    this.fish.addTo(this.scene);

    this.scene.add(this.reef.group);
    this.collision = new CollisionField(this.reef.colliders, this.reef.bounds);

    // Populate every hiding spot with its species.
    const targets: DiscoveryTarget[] = [];
    for (const spot of this.reef.hidingSpots) {
      const config = this.registry.require(spot.speciesId);
      const moray = new Moray(config);
      moray.asset.root.position.copy(spot.position);
      moray.asset.root.rotation.y = spot.facing;
      moray.asset.root.scale.setScalar(config.archetype === "ribbon" ? 1.4 : 1.5);
      this.scene.add(moray.asset.root);
      const target: DiscoveryTarget = { speciesId: config.id, position: spot.position.clone() };
      targets.push(target);
      this.morays.push({ config, moray, target });
    }
    this.discovery = new DiscoverySystem(targets);

    this.dive = new DiveController({ startPosition: new Vector3(0, 2, 22) });
    this.rig = new CameraRig(this.camera);
    this.input = new InputController(canvas);

    this.settingsPanel = new SettingsPanel({
      onChange: (partial) => this.applySettings(partial),
      onCalmMode: () => this.toggleCalmMode(),
    });

    this.hud.setTotal(this.discovery.totalCount);
    this.hud.setObjective(`Find the morays (0 / ${this.discovery.totalCount})`);

    // Restore previously discovered morays.
    for (const id of saved.discovered) {
      if (this.registry.has(id)) {
        this.discovery.markDiscovered(id);
        this.recordInCodex(this.registry.require(id));
      }
    }
    this.hud.setProgress(this.discovery.discoveredCount, this.discovery.totalCount);
    this.refreshObjective();
    this.sanctuary.setSpecies(this.discoveredConfigs());
    this.settingsPanel.sync(this.settings, this.calmActive);

    this.input.onToggleCodex.push(() => this.codex.toggle());
    this.input.onRequestHint.push(() => this.showHint());
    this.input.onToggleSanctuary.push(() => this.toggleSanctuary());
    this.input.onToggleSettings.push(() => this.toggleSettings());

    window.addEventListener("resize", this.handleResize);
    this.handleResize();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  get discoveredCount(): number {
    return this.discovery.discoveredCount;
  }

  get currentMode(): Mode {
    return this.mode;
  }

  /**
   * Read-only diver position. End-to-end tests swim by holding a key and need
   * to know when the diver has actually arrived: the simulation only advances
   * while frames render, so a wall-clock wait covers wildly different distances
   * depending on how fast the machine is drawing.
   */
  get divePosition(): { x: number; y: number; z: number } {
    return { x: this.dive.position.x, y: this.dive.position.y, z: this.dive.position.z };
  }

  private readonly frame = (now: number): void => {
    if (!this.running) {
      return;
    }
    const frameDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.advance(frameDelta);
    this.renderFrame();
    requestAnimationFrame(this.frame);
  };

  private advance(delta: number): void {
    // Before anything that can bail out: the swell is a property of the frame,
    // not of the simulation, so it keeps decaying while the reef is paused and
    // while the player is away in the sanctuary.
    if (this.pulse.isRunning) {
      this.renderer.setGradePulse(this.pulse.advance(delta, this.settings.reducedMotion));
    }

    if (this.mode === "sanctuary") {
      this.sanctuary.update(delta, this.settings.reducedMotion);
      return;
    }

    const paused = this.settingsPanel.isOpen;

    if (!paused) {
      const look = this.input.consumeLook(delta);
      if (look.yaw !== 0 || look.pitch !== 0) {
        this.rig.applyLook(look.yaw, look.pitch, this.settings.lookSensitivity);
      }
      this.loop.advance(delta, (step) => this.simulate(step));
    }

    this.rig.update(delta, this.dive.position, this.dive.velocity, this.settings);
    this.reef.update(paused ? 0 : delta, this.settings.reducedMotion);
    this.caustics.update(delta, this.settings.reducedMotion);
    this.shafts.update(delta, this.settings.reducedMotion);
    this.particles.update(delta, this.settings.reducedMotion);
    this.fish.update(paused ? 0 : delta, this.settings.reducedMotion);
    this.hud.update(delta);
  }

  private renderFrame(): void {
    if (this.mode === "sanctuary") {
      this.renderer.render(this.sanctuary.scene, this.sanctuary.camera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.renderNextPortrait();
  }

  private simulate(step: number): void {
    const input = this.input.diveInput;
    if (input.forward || input.back || input.left || input.right || input.ascend || input.descend) {
      if (!this.moved) {
        this.moved = true;
        this.hud.fadeControlsHelp();
      }
    }

    this.dive.update(step, input, this.rig.yaw);
    this.collision.resolve(this.dive.position, PLAYER_RADIUS);

    for (const instance of this.morays) {
      const discovered = this.discovery.isDiscovered(instance.config.id);
      instance.moray.update(step, this.dive.position, discovered);
      instance.moray.getHeadWorldPosition(this.headScratch);
      instance.target.position.copy(this.headScratch);
    }

    const forward = this.rig.getForward();
    const result = this.discovery.update(
      {
        cameraPosition: this.dive.position,
        forward,
        isObstructed: (t) => this.isObstructed(t.position),
      },
      step,
    );

    this.hud.setFocus(
      result.progress,
      result.focused !== null && result.progress > 0,
      result.focused !== null && this.discovery.isDiscovered(result.focused.speciesId),
    );

    if (result.newlyDiscovered) {
      this.onDiscovered(result.newlyDiscovered.speciesId);
    }
  }

  private onDiscovered(speciesId: string): void {
    const config = this.registry.require(speciesId);
    this.recordInCodex(config);
    this.hud.showDiscovery(config.commonName, config.scientificName, this.settings.reducedMotion);
    this.pulse.trigger();
    this.hud.setProgress(this.discovery.discoveredCount, this.discovery.totalCount);
    this.hud.setHint("Added to the Codex. Visit the sanctuary (V) to watch it swim.");
    this.hintLevel = -1;
    this.refreshObjective();
    this.save.recordDiscovery(speciesId, this.settings);
    this.sanctuary.setSpecies(this.discoveredConfigs());
  }

  /**
   * Files a species in the codex and queues its portrait. One path for both a
   * discovery made this dive and one restored from a save, so the codex cannot
   * end up half illustrated.
   */
  private recordInCodex(config: MoraySpeciesConfig): void {
    this.codex.record(config);
    this.portraitQueue.push(config);
  }

  /**
   * Renders one queued portrait, at most, after the frame has been presented.
   *
   * Measured at roughly a third of a second each on a software rasteriser —
   * not for any reason that shrinks with resolution — which is far too much to
   * spend inside the discovery that asked for it. Deferring costs nothing that
   * shows: the codex is closed at that moment, and the plate and the reticle
   * are CSS animations, so the ceremony keeps playing on the compositor even
   * if this stalls the frame after it.
   */
  private renderNextPortrait(): void {
    const config = this.portraitQueue.shift();
    if (config) {
      this.codex.setPortrait(config.id, renderMorayPortrait(this.renderer, config));
    }
  }

  private refreshObjective(): void {
    const found = this.discovery.discoveredCount;
    const total = this.discovery.totalCount;
    if (found >= total) {
      this.hud.setObjective("Every moray found — linger, or visit the sanctuary (V)");
    } else {
      this.hud.setObjective(`Find the morays (${found} / ${total})`);
    }
  }

  private showHint(): void {
    if (this.discovery.discoveredCount >= this.discovery.totalCount) {
      this.hud.setHint("Every moray has joined your sanctuary. Press V to visit them.");
      return;
    }
    const nearest = this.nearestUndiscovered();
    const rungs = [
      "Four morays hide across the reef. Drift slowly and watch for small movements.",
      nearest ? `Nearest clue: ${nearest.habitatHint}` : "Explore the far edges of the reef.",
      nearest
        ? `Seek the ${nearest.commonName.toLowerCase()} — centre the reticle on its eye and hold steady.`
        : "Centre the reticle on a moray's eye and hold steady.",
    ];
    this.hintLevel = Math.min(this.hintLevel + 1, rungs.length - 1);
    this.hud.setHint(rungs[this.hintLevel] ?? rungs[0] ?? "");
  }

  private nearestUndiscovered(): MoraySpeciesConfig | null {
    let best: MorayInstance | null = null;
    let bestDist = Infinity;
    for (const instance of this.morays) {
      if (this.discovery.isDiscovered(instance.config.id)) {
        continue;
      }
      const dist = instance.target.position.distanceToSquared(this.dive.position);
      if (dist < bestDist) {
        bestDist = dist;
        best = instance;
      }
    }
    return best?.config ?? null;
  }

  private discoveredConfigs(): MoraySpeciesConfig[] {
    return this.morays
      .filter((instance) => this.discovery.isDiscovered(instance.config.id))
      .map((instance) => instance.config);
  }

  private applySettings(partial: Partial<ComfortSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.calmActive = isCalm(this.settings);
    this.camera.fov = this.settings.fieldOfView;
    this.camera.updateProjectionMatrix();
    this.settingsPanel.sync(this.settings, this.calmActive);
    this.save.saveSettings(this.settings);
  }

  private toggleCalmMode(): void {
    if (this.calmActive) {
      this.applySettings(DEFAULT_SETTINGS);
    } else {
      this.applySettings(CALM_MODE_SETTINGS);
    }
  }

  private toggleSettings(): void {
    this.settingsPanel.toggle();
    if (this.settingsPanel.isOpen) {
      document.exitPointerLock?.();
    }
  }

  private toggleSanctuary(): void {
    if (this.mode === "reef") {
      this.mode = "sanctuary";
      this.sanctuary.setSpecies(this.discoveredConfigs());
      this.sanctuaryOverlay.show(this.discoveredConfigs());
      this.hud.setDiveVisible(false);
      document.exitPointerLock?.();
      this.handleResize();
    } else {
      this.mode = "reef";
      this.sanctuaryOverlay.hide();
      this.hud.setDiveVisible(true);
      this.lastTime = performance.now();
    }
  }

  private isObstructed(targetPosition: Vector3): boolean {
    this.rayDir.subVectors(targetPosition, this.dive.position);
    const distance = this.rayDir.length();
    if (distance < 0.001) {
      return false;
    }
    this.rayDir.multiplyScalar(1 / distance);
    this.raycaster.set(this.dive.position, this.rayDir);
    this.raycaster.far = Math.max(0.05, distance - 0.6);
    const hits = this.raycaster.intersectObjects(this.reef.obstructionMeshes, false);
    return hits.length > 0;
  }

  /**
   * Visual-QA hook. Stops the live loop, places the diver, then advances the
   * world by whole fixed steps and holds the resulting frame on screen. With
   * the seeded reef this makes a screenshot reproducible, which is the only
   * way to compare an art-direction change against the shot it replaces.
   */
  capture(pose: CapturePose = {}): void {
    this.running = false;
    this.renderer.pinRenderScale(1);

    // A shot must not depend on how many frames happened to have drawn before
    // it, so the portraits are all finished here rather than one per frame.
    while (this.portraitQueue.length > 0) {
      this.renderNextPortrait();
    }

    if (pose.position) {
      this.dive.position.set(...pose.position);
    }
    this.dive.velocity.set(0, 0, 0);
    if (pose.yaw !== undefined) {
      this.rig.yaw = pose.yaw;
    }
    if (pose.pitch !== undefined) {
      this.rig.pitch = pose.pitch;
    }

    const step = 1 / 60;
    const steps = Math.max(1, Math.round((pose.settle ?? 1.5) / step));
    for (let i = 0; i < steps; i++) {
      this.advance(step);
    }

    // Re-present the same frame every vsync: a WebGL drawing buffer is not
    // preserved after compositing, so a one-shot render can screenshot blank.
    if (!this.holding) {
      this.holding = true;
      requestAnimationFrame(this.holdFrame);
    }
  }

  private readonly holdFrame = (): void => {
    if (!this.holding) {
      return;
    }
    this.renderFrame();
    requestAnimationFrame(this.holdFrame);
  };

  private readonly handleResize = (): void => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.sanctuary.resize(width, height);
    this.renderer.setSize(width, height);
  };

  dispose(): void {
    this.running = false;
    this.holding = false;
    window.removeEventListener("resize", this.handleResize);
    this.input.dispose();
    this.renderer.dispose();
  }
}

function isCalm(settings: ComfortSettings): boolean {
  return (
    !settings.cameraBob &&
    !settings.cameraRoll &&
    settings.autoLevel &&
    settings.reducedMotion
  );
}
