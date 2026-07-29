import { PerspectiveCamera, Raycaster, Scene, Vector3 } from "three";
import {
  CALM_MODE_SETTINGS,
  DEFAULT_SETTINGS,
  type ComfortSettings,
} from "../accessibility/AccessibilitySettings";
import { ReefSoundscape } from "../audio/ReefSoundscape";
import { AnemoneGarden } from "../creatures/fauna/AnemoneGarden";
import { Crabs } from "../creatures/fauna/Crabs";
import { Shrimp } from "../creatures/fauna/Shrimp";
import { Starfish } from "../creatures/fauna/Starfish";
import { Urchins } from "../creatures/fauna/Urchins";
import { FishSchoolSystem } from "../creatures/fish/FishSchoolSystem";
import { LifeRegistry, type LifeContext } from "../creatures/life/LifeSystem";
import { Moray } from "../creatures/morays/Moray";
import { MorayRegistry } from "../creatures/morays/MorayRegistry";
import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";
import { JellyBloom } from "../creatures/visitors/JellyBloom";
import { Ray } from "../creatures/visitors/Ray";
import { Turtle } from "../creatures/visitors/Turtle";
import { VisitorSchedule } from "../creatures/visitors/VisitorSchedule";
import { DiscoverySystem, type DiscoveryTarget } from "../discovery/DiscoverySystem";
import { DiveController } from "../player/DiveController";
import { CameraRig } from "../player/CameraRig";
import { InputController } from "../player/InputController";
import { assetsPending } from "../rendering/AssetLibrary";
import { Bubbles } from "../rendering/Bubbles";
import { CausticsSystem } from "../rendering/CausticsSystem";
import { DiscoveryPulse } from "../rendering/DiscoveryPulse";
import { LightShafts } from "../rendering/LightShafts";
import { Lighting } from "../rendering/Lighting";
import { Particles } from "../rendering/Particles";
import { SandPuffs } from "../rendering/SandPuffs";
import { UnderwaterFog } from "../rendering/UnderwaterFog";
import { WeatherMoods, type WeatherState } from "../rendering/WeatherMoods";
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
import { MorayCuriosity } from "./MorayCuriosity";
import { RendererAdapter } from "./RendererAdapter";

const PLAYER_RADIUS = 0.6;

interface MorayInstance {
  readonly config: MoraySpeciesConfig;
  readonly moray: Moray;
  readonly target: DiscoveryTarget;
  /**
   * When this animal watches the diver (W-N5). It used to be
   * `curious = discovered`, which pinned every discovered head on the diver
   * for the rest of the session and hid the presence-cycle poses forever;
   * the latch engages on genuine attention and relaxes after a sustained
   * quiet spell. See `MorayCuriosity`.
   */
  readonly curiosity: MorayCuriosity;
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
  /** The sky's slow moods (W-M1). The reef's, only: the sanctuary keeps noon. */
  private readonly weather = new WeatherMoods();
  /** Whether the weather has written the grade, so identity restores it once. */
  private gradeTinted = false;
  private readonly particles = new Particles();
  private readonly bubbles = new Bubbles();
  private readonly fish = new FishSchoolSystem();

  /**
   * Everything alive in the reef that is not a moray or a shoal, behind one
   * handle. A package that adds a population adds it to this list and touches
   * nothing else in this file — which is the entire reason the list exists
   * before any of the animals in it do.
   */
  private readonly life = new LifeRegistry([
    new Crabs(),
    new Starfish(),
    new Urchins(),
    new AnemoneGarden(),
    new VisitorSchedule(),
    new Turtle(),
    new Ray(),
    new JellyBloom(),
    new SandPuffs(),
    new Shrimp(),
  ]);
  private readonly lifeContext: LifeContext = {
    diverPosition: new Vector3(),
    diverSpeed: 0,
    reducedMotion: false,
    time: 0,
  };

  private readonly registry = new MorayRegistry();
  private readonly morays: MorayInstance[] = [];

  private readonly dive: DiveController;
  private readonly rig: CameraRig;
  private readonly input: InputController;
  private readonly soundscape = new ReefSoundscape();

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
  /**
   * Which moray the focus scanner held last step, for the curiosity latch.
   * One fixed step stale by construction — `discovery.update` needs the
   * heads this step's moray updates produce, so it runs after them — and a
   * sixtieth of a second of lag on an 18-second relax window is nothing.
   */
  private lastFocusedId: string | null = null;
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

    // W-M1: the reef's water, lights, beams and dapples opt into the sky's
    // slow moods. The sanctuary's own instances never attach, so the room
    // stays at its own noon by construction.
    const fog = new UnderwaterFog({ backdropAsset: "world/backdrop.png" });
    fog.attachWeather(this.weather);
    fog.applyTo(this.scene);
    const lighting = new Lighting();
    lighting.attachWeather(this.weather);
    lighting.addTo(this.scene);
    this.shafts = new LightShafts(lighting.sun.position);
    this.shafts.attachWeather(this.weather);
    this.shafts.addTo(this.scene);
    this.caustics.attachWeather(this.weather);
    this.caustics.addTo(this.scene);
    this.particles.addTo(this.scene);
    this.bubbles.addTo(this.scene);
    this.fish.addTo(this.scene);
    this.life.addTo(this.scene);

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
      this.morays.push({ config, moray, target, curiosity: new MorayCuriosity() });
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
    // Nothing is audible — and no context exists — until the player touches
    // something. The reef comes up already knowing how loud it should be.
    this.applyAudioSettings();
    this.input.onFirstGesture.push(() => this.soundscape.start());

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
   * Whether every authored asset requested so far has loaded or failed.
   *
   * The capture scripts poll this before posing. A texture that lands one frame
   * after the shutter is the one way this scene stops being reproducible, and
   * it would look exactly like an art change.
   */
  get assetsReady(): boolean {
    return !assetsPending();
  }

  /** The soundscape, exposed for the audio probe the way `__reef` is. */
  get audio(): ReefSoundscape {
    return this.soundscape;
  }

  /** The adaptive scaler's current internal resolution; a W-L8 QA door. */
  get renderScale(): number {
    return this.renderer.currentRenderScale;
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

    // The soundscape rides the frame rather than the fixed step, for the same
    // reason: it has to keep breathing in the sanctuary and behind the comfort
    // panel, where the simulation does not run at all.
    const paused = this.settingsPanel.isOpen;
    this.soundscape.setPanelOpen(paused);
    this.soundscape.update(delta, this.mode === "reef" && !paused && this.isSwimming());

    if (this.mode === "sanctuary") {
      this.sanctuary.update(delta, this.settings.reducedMotion);
      return;
    }

    if (!paused) {
      const look = this.input.consumeLook(delta);
      if (look.yaw !== 0 || look.pitch !== 0) {
        this.rig.applyLook(look.yaw, look.pitch, this.settings.lookSensitivity);
      }
      this.loop.advance(delta, (step) => this.simulate(step));
    }

    this.rig.update(delta, this.dive.position, this.dive.velocity, this.settings);
    this.reef.update(paused ? 0 : delta, this.settings.reducedMotion);
    // The weather rides the frame clock like the caustics and shafts below,
    // which read its channels inside their own updates — so it advances
    // first, and keeps passing while the comfort panel holds the simulation.
    this.weather.update(delta);
    this.applyWeatherGrade();
    this.caustics.update(delta, this.settings.reducedMotion);
    // After the rig has placed the camera: the shafts fade whichever of their
    // quads the eye is looking along, and that is a property of where it is
    // this frame.
    this.shafts.update(delta, this.settings.reducedMotion, this.camera.position);
    this.particles.update(delta, this.settings.reducedMotion);
    // After the rig as well: every bubble is a quad that has to be turned to
    // face wherever the lens ended up this frame.
    this.bubbles.update(delta, this.settings.reducedMotion, this.camera.quaternion);
    // Also after the rig, and for the same reason the shafts are: the shoals
    // bend their course around the diver rather than swimming through them.
    this.fish.update(paused ? 0 : delta, this.settings.reducedMotion, this.camera.position);
    // The reef's own inhabitants, from where the diver is rather than where
    // the lens is: what startles a crab is a body arriving, and the two part
    // company the moment the camera lags or leads.
    const step = paused ? 0 : delta;
    const context = this.lifeContext;
    context.diverPosition.copy(this.dive.position);
    context.diverSpeed = this.dive.velocity.length();
    context.reducedMotion = this.settings.reducedMotion;
    context.time += step;
    this.life.update(step, context);
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
    if (this.isSwimming() && !this.moved) {
      this.moved = true;
      this.hud.fadeControlsHelp();
    }

    this.dive.update(step, input, this.rig.yaw);
    this.collision.resolve(this.dive.position, PLAYER_RADIUS);

    for (const instance of this.morays) {
      // Curiosity is attention with a slow release, not a permanent flag:
      // a discovered moray watches a diver who is focusing it or standing
      // close, and lets go after a sustained quiet spell — so a completed
      // save's reef returns to its den poses instead of holding every head
      // on the diver forever. Pre-discovery the latch always reports false,
      // exactly as the old `curious = discovered` did.
      const curious = instance.curiosity.update(step, {
        discovered: this.discovery.isDiscovered(instance.config.id),
        focused: this.lastFocusedId === instance.config.id,
        distance: this.dive.position.distanceTo(instance.target.position),
      });
      instance.moray.update(step, this.dive.position, curious);
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
    this.lastFocusedId = result.focused?.speciesId ?? null;

    this.hud.setFocus(
      result.progress,
      result.focused !== null && result.progress > 0,
      result.focused !== null && this.discovery.isDiscovered(result.focused.speciesId),
    );

    if (result.newlyDiscovered) {
      this.onDiscovered(result.newlyDiscovered.speciesId);
    }
  }

  /**
   * Writes W-M1's grade tilt through the renderer's one door — only while a
   * mood is actually on, with one reset on the way back, so the default
   * frame's grade uniforms are the shipped values untouched.
   */
  private applyWeatherGrade(): void {
    if (!this.weather.isIdentity) {
      const channels = this.weather.channels;
      this.renderer.setWeatherGrade(
        channels.gradeRed,
        channels.gradeGreen,
        channels.gradeBlue,
        channels.gradeSaturation,
      );
      this.gradeTinted = true;
    } else if (this.gradeTinted) {
      this.renderer.setWeatherGrade(1, 1, 1, 1);
      this.gradeTinted = false;
    }
  }

  /**
   * W-M1's QA door, exposed on `window.__reef`: pins the sky at `blend` of
   * the way from bright noon into the named mood (1 is the mood in full,
   * 0.5 is mid-crossfade), or resumes the schedule on `null`. The grade is
   * pushed immediately so a held capture frame needs no further advance.
   */
  setMood(name: string | null, blend = 1): void {
    this.weather.setMood(name, blend);
    this.applyWeatherGrade();
  }

  /** Where the weather schedule stands, for the probes and the harness. */
  get weatherState(): WeatherState {
    return this.weather.state;
  }

  /** Whether the player is holding any of the swim keys. */
  private isSwimming(): boolean {
    const input = this.input.diveInput;
    return (
      input.forward || input.back || input.left || input.right || input.ascend || input.descend
    );
  }

  private onDiscovered(speciesId: string): void {
    const config = this.registry.require(speciesId);
    this.recordInCodex(config);
    this.hud.showDiscovery(config.commonName, config.scientificName, this.settings.reducedMotion);
    this.pulse.trigger();
    this.soundscape.playDiscovery();
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
    // A portrait is baked once, into a data URL that nothing ever revisits, so
    // it has to be taken after the painted skins have landed or the codex keeps
    // a procedural plate of an animal that no longer looks like that.
    if (assetsPending()) {
      return;
    }
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
    const countWords = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
    const countWord = countWords[this.discovery.totalCount] ?? String(this.discovery.totalCount);
    const rungs = [
      `${countWord} morays hide across the reef. Drift slowly and watch for small movements.`,
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
    this.applyAudioSettings();
    this.settingsPanel.sync(this.settings, this.calmActive);
    this.save.saveSettings(this.settings);
  }

  private applyAudioSettings(): void {
    this.soundscape.setVolume(this.settings.soundVolume);
    this.soundscape.setReducedMotion(this.settings.reducedMotion);
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
      // The room keeps its own noon, and the grade pass is shared between the
      // two scenes — take the weather's tilt off before the room draws. The
      // reef's advance() puts it back on the first frame after the return.
      if (this.gradeTinted) {
        this.renderer.setWeatherGrade(1, 1, 1, 1);
        this.gradeTinted = false;
      }
      this.soundscape.setSanctuary(true);
      this.sanctuary.setSpecies(this.discoveredConfigs());
      this.sanctuaryOverlay.show(this.discoveredConfigs());
      this.hud.setDiveVisible(false);
      document.exitPointerLock?.();
      this.handleResize();
    } else {
      this.mode = "reef";
      this.soundscape.setSanctuary(false);
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
    // The readiness term is what stops that being a spin: an asset still in
    // flight makes `renderNextPortrait` a no-op, and the queue would never
    // shorten. The harness waits on `assetsReady` before posing precisely so
    // this drains.
    while (this.portraitQueue.length > 0 && !assetsPending()) {
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
    this.life.dispose();
    this.input.dispose();
    this.soundscape.dispose();
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
