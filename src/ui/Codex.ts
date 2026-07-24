import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";
import { requireElement } from "./dom";

/**
 * The illustrated Moray Codex. Discovered species are appended as cards; the
 * panel can be toggled without pausing the world (the dive is calm either way).
 */
export class Codex {
  private readonly panel: HTMLElement;
  private readonly entries: HTMLElement;
  private readonly emptyState: HTMLElement | null;
  private readonly closeButton: HTMLElement;
  private readonly recorded = new Set<string>();

  constructor(root: Document = document) {
    this.panel = requireElement(root, "codex");
    this.entries = requireElement(root, "codex-entries");
    this.emptyState = this.entries.querySelector(".codex__empty");
    this.closeButton = requireElement(root, "codex-close");
    this.closeButton.addEventListener("click", () => this.close());
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

  record(config: MoraySpeciesConfig): void {
    if (this.recorded.has(config.id)) {
      return;
    }
    this.recorded.add(config.id);
    this.emptyState?.remove();

    const entry = document.createElement("div");
    entry.className = "codex__entry";
    entry.dataset.speciesId = config.id;
    entry.innerHTML = `
      <h3>${config.commonName}</h3>
      <div class="sci">${config.scientificName}</div>
      <p>${config.fact}</p>
    `;
    this.entries.appendChild(entry);
  }
}
