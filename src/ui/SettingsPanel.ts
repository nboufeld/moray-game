import type { ComfortSettings } from "../accessibility/AccessibilitySettings";

export interface SettingsPanelCallbacks {
  onChange: (partial: Partial<ComfortSettings>) => void;
  onCalmMode: () => void;
}

/**
 * DOM controller for the comfort/accessibility panel. Every underlying option
 * stays individually adjustable; the Calm Mode button applies a preset but
 * leaves the individual toggles editable afterward.
 */
export class SettingsPanel {
  private readonly panel: HTMLElement;
  private readonly calmButton: HTMLButtonElement;
  private readonly bob: HTMLInputElement;
  private readonly roll: HTMLInputElement;
  private readonly autoLevel: HTMLInputElement;
  private readonly reduced: HTMLInputElement;
  private readonly fov: HTMLInputElement;
  private readonly fovValue: HTMLElement;

  constructor(
    private readonly callbacks: SettingsPanelCallbacks,
    root: Document = document,
  ) {
    this.panel = requireEl(root, "settings-panel");
    this.calmButton = requireEl(root, "settings-calm") as HTMLButtonElement;
    this.bob = requireEl(root, "opt-bob") as HTMLInputElement;
    this.roll = requireEl(root, "opt-roll") as HTMLInputElement;
    this.autoLevel = requireEl(root, "opt-autolevel") as HTMLInputElement;
    this.reduced = requireEl(root, "opt-reduced") as HTMLInputElement;
    this.fov = requireEl(root, "opt-fov") as HTMLInputElement;
    this.fovValue = requireEl(root, "opt-fov-value");

    this.calmButton.addEventListener("click", () => this.callbacks.onCalmMode());
    this.bob.addEventListener("change", () => this.callbacks.onChange({ cameraBob: this.bob.checked }));
    this.roll.addEventListener("change", () => this.callbacks.onChange({ cameraRoll: this.roll.checked }));
    this.autoLevel.addEventListener("change", () =>
      this.callbacks.onChange({ autoLevel: this.autoLevel.checked }),
    );
    this.reduced.addEventListener("change", () =>
      this.callbacks.onChange({ reducedMotion: this.reduced.checked }),
    );
    this.fov.addEventListener("input", () => {
      const value = Number(this.fov.value);
      this.fovValue.textContent = String(value);
      this.callbacks.onChange({ fieldOfView: value });
    });

    requireEl(root, "settings-close").addEventListener("click", () => this.close());
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.panel.hidden = false;
  }

  close(): void {
    this.panel.hidden = true;
  }

  /** Reflects the current settings into the controls (e.g. after Calm Mode). */
  sync(settings: ComfortSettings, calmActive: boolean): void {
    this.bob.checked = settings.cameraBob;
    this.roll.checked = settings.cameraRoll;
    this.autoLevel.checked = settings.autoLevel;
    this.reduced.checked = settings.reducedMotion;
    this.fov.value = String(settings.fieldOfView);
    this.fovValue.textContent = String(settings.fieldOfView);
    this.calmButton.classList.toggle("is-active", calmActive);
    this.calmButton.textContent = calmActive ? "Calm Mode on" : "Enable Calm Mode";
  }
}

function requireEl(root: Document, id: string): HTMLElement {
  const element = root.getElementById(id);
  if (!element) {
    throw new Error(`Missing settings element #${id}`);
  }
  return element;
}
