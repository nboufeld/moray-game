import { PerspectiveCamera, Raycaster, Scene, Vector3 } from "three";
import { DEFAULT_SETTINGS, type ComfortSettings } from "../accessibility/AccessibilitySettings";
import { Moray } from "../creatures/morays/Moray";
import { MorayRegistry } from "../creatures/morays/MorayRegistry";
import { DiscoverySystem, type DiscoveryTarget } from "../discovery/DiscoverySystem";
import { HintSystem } from "../discovery/HintSystem";
import { DiveController } from "../player/DiveController";
import { CameraRig } from "../player/CameraRig";
import { InputController } from "../player/InputController";
import { CausticsSystem } from "../rendering/CausticsSystem";
import { Lighting } from "../rendering/Lighting";
import { Particles } from "../rendering/Particles";
import { UnderwaterFog } from "../rendering/UnderwaterFog";
import { Codex } from "../ui/Codex";
import { Hud } from "../ui/Hud";
import { CollisionField } from "../world/CollisionField";
import { Reef } from "../world/Reef";
import { GameLoop } from "./GameLoop";
import { RendererAdapter } from "./RendererAdapter";

const PLAYER_RADIUS = 0.6;

export class Game {
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: RendererAdapter;
  private readonly loop = new GameLoop();

  private readonly reef = new Reef();
  private readonly collision: CollisionField;
  private readonly caustics = new CausticsSystem();
  private readonly particles = new Particles();

  private readonly registry = new MorayRegistry();
  private readonly moray: Moray;

  private readonly dive: DiveController;
  private readonly rig: CameraRig;
  private readonly input: InputController;

  private readonly discovery: DiscoverySystem;
  private readonly hints: HintSystem;
  private readonly hud = new Hud();
  private readonly codex = new Codex();

  private readonly settings: ComfortSettings = { ...DEFAULT_SETTINGS };

  private readonly raycaster = new Raycaster();
  private readonly rayDir = new Vector3();
  private readonly morayHead = new Vector3();
  private readonly target: DiscoveryTarget;

  private lastTime = 0;
  private running = false;
  private moved = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.camera = new PerspectiveCamera(this.settings.fieldOfView, 1, 0.1, 140);
    this.renderer = new RendererAdapter(canvas);

    // Atmosphere.
    new UnderwaterFog().applyTo(this.scene);
    new Lighting().addTo(this.scene);
    this.caustics.addTo(this.scene);
    this.particles.addTo(this.scene);

    // World.
    this.scene.add(this.reef.group);
    this.collision = new CollisionField(this.reef.colliders, this.reef.bounds);

    // Hero moray hidden in the crevice.
    const species = this.registry.require("snowflake-moray");
    this.moray = new Moray(species);
    this.moray.asset.root.position.copy(this.reef.crevicePosition);
    this.moray.asset.root.scale.setScalar(1.5);
    this.scene.add(this.moray.asset.root);

    // Player + camera.
    this.dive = new DiveController({ startPosition: new Vector3(0, 2, 22) });
    this.rig = new CameraRig(this.camera);
    this.input = new InputController(canvas);

    // Discovery.
    this.target = { speciesId: species.id, position: this.reef.crevicePosition.clone() };
    this.discovery = new DiscoverySystem([this.target]);
    this.hints = new HintSystem([
      "The reef is calm. Somewhere here, a shy moray is watching.",
      species.habitatHint,
      "Watch for the dark cave mouth between the pale rocks ahead.",
      "A faint rhythmic movement betrays a breathing jaw in the shadow.",
      "There — centre the reticle on the eye in the crevice and hold steady.",
    ]);

    this.hud.setTotal(this.discovery.totalCount);
    this.hud.setObjective("Find the hidden moray");

    this.input.onToggleCodex.push(() => this.codex.toggle());
    this.input.onRequestHint.push(() => this.hud.setHint(this.hints.next()));

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

  private readonly frame = (now: number): void => {
    if (!this.running) {
      return;
    }
    const frameDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Look is applied once per frame from accumulated input.
    const look = this.input.consumeLook(frameDelta);
    if (look.yaw !== 0 || look.pitch !== 0) {
      this.rig.applyLook(look.yaw, look.pitch, this.settings.lookSensitivity);
    }

    this.loop.advance(frameDelta, (step) => this.simulate(step));

    // Rendering-side updates (smooth, per-frame).
    this.rig.update(frameDelta, this.dive.position, this.dive.velocity, this.settings);
    this.caustics.update(frameDelta, this.settings.reducedMotion);
    this.particles.update(frameDelta, this.settings.reducedMotion);
    this.hud.update(frameDelta);

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  };

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

    const discovered = this.discovery.isDiscovered(this.target.speciesId);
    this.moray.update(step, this.dive.position, discovered);
    this.moray.getHeadWorldPosition(this.morayHead);
    this.target.position.copy(this.morayHead);

    const forward = this.rig.getForward();
    const result = this.discovery.update(
      {
        cameraPosition: this.dive.position,
        forward,
        isObstructed: (t) => this.isObstructed(t.position),
      },
      step,
    );

    this.hud.setFocus(result.progress, result.focused !== null && result.progress > 0, discovered);

    if (result.newlyDiscovered) {
      const config = this.registry.require(result.newlyDiscovered.speciesId);
      this.codex.record(config);
      this.hud.showDiscovery(config.commonName, config.scientificName);
      this.hud.setProgress(this.discovery.discoveredCount, this.discovery.totalCount);
      this.hud.setHint("Added to the Codex. A dream of it now swims in the sanctuary.");
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
    this.raycaster.far = Math.max(0.05, distance - 0.5);
    const hits = this.raycaster.intersectObjects(this.reef.obstructionMeshes, false);
    return hits.length > 0;
  }

  private readonly handleResize = (): void => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  /** Number of morays discovered so far (exposed for lightweight e2e checks). */
  get discoveredCount(): number {
    return this.discovery.discoveredCount;
  }

  dispose(): void {
    this.running = false;
    window.removeEventListener("resize", this.handleResize);
    this.input.dispose();
    this.renderer.dispose();
  }
}
