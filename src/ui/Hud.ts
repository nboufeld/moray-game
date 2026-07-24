/**
 * Thin DOM controller for the heads-up display: objective, progress count,
 * hint line, the focus reticle and the discovery toast.
 */
export class Hud {
  private readonly objectiveText: HTMLElement;
  private readonly foundCount: HTMLElement;
  private readonly totalCount: HTMLElement;
  private readonly hintText: HTMLElement;
  private readonly reticle: HTMLElement;
  private readonly reticleFill: SVGCircleElement;
  private readonly toast: HTMLElement;
  private readonly controlsHelp: HTMLElement;

  private toastTimer = 0;
  private readonly circumference = 2 * Math.PI * 20;

  constructor(root: Document = document) {
    this.objectiveText = requireEl(root, "objective-text");
    this.foundCount = requireEl(root, "found-count");
    this.totalCount = requireEl(root, "total-count");
    this.hintText = requireEl(root, "hint-text");
    this.reticle = requireEl(root, "reticle");
    this.reticleFill = requireEl(root, "reticle-fill") as unknown as SVGCircleElement;
    this.toast = requireEl(root, "discovery-toast");
    this.controlsHelp = requireEl(root, "controls-help");
  }

  setTotal(total: number): void {
    this.totalCount.textContent = String(total);
  }

  setProgress(found: number, total: number): void {
    this.foundCount.textContent = String(found);
    if (found >= total) {
      this.objectiveText.textContent = "Every moray found — linger a while";
    }
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

  showDiscovery(commonName: string, scientificName: string): void {
    this.toast.innerHTML = `Discovered <strong>${commonName}</strong><br /><em>${scientificName}</em>`;
    this.toast.hidden = false;
    this.toastTimer = 4;
  }

  fadeControlsHelp(): void {
    this.controlsHelp.style.opacity = "0.25";
  }

  update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toast.hidden = true;
      }
    }
  }
}

function requireEl(root: Document, id: string): HTMLElement {
  const element = root.getElementById(id);
  if (!element) {
    throw new Error(`Missing HUD element #${id}`);
  }
  return element;
}
