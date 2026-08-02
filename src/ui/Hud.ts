import { requireElement } from "./dom";

/** How long the discovery name plate holds before it fades out. */
const PLATE_SECONDS = 2.5;
/** How long the reticle keeps its celebration class after a discovery. */
const RETICLE_SECONDS = 0.9;

/**
 * Thin DOM controller for the heads-up display: objective, progress count,
 * hint line, the focus reticle and the discovery ceremony.
 */
export class Hud {
  private readonly container: HTMLElement;
  private readonly objectiveText: HTMLElement;
  private readonly foundCount: HTMLElement;
  private readonly totalCount: HTMLElement;
  private readonly hintText: HTMLElement;
  private readonly reticle: HTMLElement;
  private readonly reticleRing: HTMLElement;
  private readonly reticleFill: SVGCircleElement;
  private readonly plate: HTMLElement;
  private readonly controlsHelp: HTMLElement;

  private plateTimer = 0;
  private reticleTimer = 0;
  private readonly circumference = 2 * Math.PI * 20;

  constructor(root: Document = document) {
    this.container = requireElement(root, "hud");
    this.objectiveText = requireElement(root, "objective-text");
    this.foundCount = requireElement(root, "found-count");
    this.totalCount = requireElement(root, "total-count");
    this.hintText = requireElement(root, "hint-text");
    this.reticle = requireElement(root, "reticle");
    this.reticleRing = requireElement(root, "reticle-ring");
    this.reticleFill = requireElement(root, "reticle-fill") as unknown as SVGCircleElement;
    this.plate = requireElement(root, "discovery-toast");
    this.controlsHelp = requireElement(root, "controls-help");
  }

  setTotal(total: number): void {
    this.totalCount.textContent = String(total);
  }

  setProgress(found: number, _total: number): void {
    this.foundCount.textContent = String(found);
  }

  setObjective(text: string): void {
    this.objectiveText.textContent = text;
  }

  setHint(text: string): void {
    this.hintText.textContent = text;
  }

  setFocus(progress: number, aligned: boolean, completed: boolean): void {
    const offset = this.circumference * (1 - progress);
    this.reticleFill.style.strokeDashoffset = String(offset);
    this.reticle.classList.toggle("is-focusing", aligned && !completed && progress > 0);
    this.reticle.classList.toggle("is-found", completed);
  }

  /**
   * The discovery ceremony: the reticle blooms open around the creature the
   * player just held it on, and a name plate rises across the foot of the
   * frame. Nothing here takes input or stops the dive — the moment plays over
   * a reef the player is still swimming through.
   */
  showDiscovery(commonName: string, scientificName: string, reducedMotion = false): void {
    this.plate.innerHTML = `
      <span class="discovery-plate__eyebrow">Recorded in the Codex</span>
      <span class="discovery-plate__name">${commonName}</span>
      <span class="discovery-plate__sci">${scientificName}</span>
    `;
    this.plate.hidden = false;
    // The calm variants cross-fade instead of travelling or scaling.
    this.plate.classList.toggle("is-calm", reducedMotion);
    this.reticle.classList.toggle("is-calm", reducedMotion);
    restartAnimation(this.plate, "is-showing");
    restartAnimation(this.reticleRing, "is-blooming");
    this.plateTimer = PLATE_SECONDS;
    this.reticleTimer = RETICLE_SECONDS;
  }

  fadeControlsHelp(): void {
    this.controlsHelp.style.opacity = "0.25";
  }

  /** Hides the dive HUD (used while inside the sanctuary). */
  setDiveVisible(visible: boolean): void {
    this.container.hidden = !visible;
    this.reticle.hidden = !visible;
    this.controlsHelp.hidden = !visible;
  }

  update(dt: number): void {
    if (this.plateTimer > 0) {
      this.plateTimer -= dt;
      if (this.plateTimer <= 0) {
        this.plate.hidden = true;
        this.plate.classList.remove("is-showing");
      }
    }
    if (this.reticleTimer > 0) {
      this.reticleTimer -= dt;
      if (this.reticleTimer <= 0) {
        this.reticleRing.classList.remove("is-blooming");
      }
    }
  }
}

/**
 * Replays a CSS animation on an element that may already be showing. Reading a
 * layout property between the two class writes forces the style change to
 * flush; without it the browser coalesces them and the second discovery of a
 * session plays nothing.
 */
function restartAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  element.getBoundingClientRect();
  element.classList.add(className);
}
