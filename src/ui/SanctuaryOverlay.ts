import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";

/**
 * DOM overlay shown while inside the sanctuary: a species card per discovered
 * moray plus a prompt to return to the dive.
 */
export class SanctuaryOverlay {
  private readonly overlay: HTMLElement;
  private readonly cards: HTMLElement;

  constructor(root: Document = document) {
    this.overlay = requireEl(root, "sanctuary-overlay");
    this.cards = requireEl(root, "sanctuary-cards");
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  show(configs: readonly MoraySpeciesConfig[]): void {
    this.cards.innerHTML = "";
    if (configs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sanctuary-card";
      empty.innerHTML = "<p>No morays discovered yet. Dive the reef and one will join you here.</p>";
      this.cards.appendChild(empty);
    } else {
      for (const config of configs) {
        const card = document.createElement("div");
        card.className = "sanctuary-card";
        card.dataset.speciesId = config.id;
        card.innerHTML = `
          <h3>${config.commonName}</h3>
          <div class="sci">${config.scientificName}</div>
          <p>${config.fact}</p>
        `;
        this.cards.appendChild(card);
      }
    }
    this.overlay.hidden = false;
  }

  hide(): void {
    this.overlay.hidden = true;
  }
}

function requireEl(root: Document, id: string): HTMLElement {
  const element = root.getElementById(id);
  if (!element) {
    throw new Error(`Missing sanctuary element #${id}`);
  }
  return element;
}
