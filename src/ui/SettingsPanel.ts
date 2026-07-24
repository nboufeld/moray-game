import type { ComfortSettings } from "../accessibility/AccessibilitySettings";
import { requireElement } from "./dom";

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
  private readonly sensitivity: HTMLInputElement;
  private readonly sensitivityValue: HTMLElement;

  constructor(
    private readonly callbacks: SettingsPanelCallbacks,
    root: Document = document,
  ) {
    this.panel = requireElement(root, "settings-panel");
    this.calmButton = requireElement(root, "settings-calm") as HTMLButtonElement;
    this.bob = requireElement(root, "opt-bob") as HTMLInputElement;
    this.roll = requireElement(root, "opt-roll") as HTMLInputElement;
    this.autoLevel = requireElement(root, "opt-autolevel") as HTMLInputElement;
    this.reduced = requireElement(root, "opt-reduced") as HTMLInputElement;
    this.fov = requireElement(root, "opt-fov") as HTMLInputElement;
    this.fovValue = requireElement(root, "opt-fov-value");
    this.sensitivity = requireElement(root, "opt-sensitivity") as HTMLInputElement;
    this.sensitivityValue = requireElement(root, "opt-sensitivity-value");

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
    this.sensitivity.addEventListener("input", () => {
      const value = Number(this.sensitivity.value);
      this.sensitivityValue.textContent = formatSensitivity(value);
      this.callbacks.onChange({ lookSensitivity: value });
    });

    requireElement(root, "settings-close").addEventListener("click", () => this.close());
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
    this.sensitivity.value = String(settings.lookSensitivity);
    this.sensitivityValue.textContent = formatSensitivity(settings.lookSensitivity);
    this.calmButton.classList.toggle("is-active", calmActive);
    this.calmButton.textContent = calmActive ? "Calm Mode on" : "Enable Calm Mode";
  }
}

function formatSensitivity(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}
