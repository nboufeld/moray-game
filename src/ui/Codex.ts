import { personalityFor } from "../creatures/morays/MorayPersonality";
import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";
import { requireElement } from "./dom";

/**
 * One codex card's worth of species, whoever it belongs to (Wave 8): the
 * morays' configs adapt onto this, and the mythics carry their own.
 */
export interface CodexEntry {
  readonly id: string;
  readonly commonName: string;
  readonly scientificName: string;
  readonly fact: string;
  /** The storybook line under the fact. */
  readonly codexLine: string;
}

/**
 * A transparent pixel. The card's frame stands empty for the frame or two
 * before its plate is rendered, rather than showing a broken image.
 */
const EMPTY_PLATE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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

  /**
   * Adds a species card, with an empty frame where its portrait will go. The
   * card is complete without the image — a renderer that cannot produce one
   * never costs the player the entry.
   */
  record(config: MoraySpeciesConfig): void {
    // The personality line (W-M2): one storybook sentence of who this animal
    // is, under the field-guide fact. A species without a profile wears the
    // default's gentle line, so a new species is never a broken card.
    this.recordEntry({
      id: config.id,
      commonName: config.commonName,
      scientificName: config.scientificName,
      fact: config.fact,
      codexLine: personalityFor(config.id).codexLine,
    });
  }

  /** Wave 8: one card path for every kind of being — morays and mythics. */
  recordEntry(entry: CodexEntry): void {
    if (this.recorded.has(entry.id)) {
      return;
    }
    this.recorded.add(entry.id);
    this.emptyState?.remove();

    // A second `<p>` on purpose — `.codex__entry p` already styles it, and
    // the card's markup contract (classes, roles, order) is untouched.
    const card = document.createElement("div");
    card.className = "codex__entry";
    card.dataset.speciesId = entry.id;
    card.innerHTML = `
      <img class="codex__portrait" src="${EMPTY_PLATE}" alt="Portrait of the ${entry.commonName.toLowerCase()}" />
      <div class="codex__text">
        <h3>${entry.commonName}</h3>
        <div class="sci">${entry.scientificName}</div>
        <p>${entry.fact}</p>
        <p class="codex__personality"><em>${entry.codexLine}</em></p>
      </div>
    `;
    this.entries.appendChild(card);
  }

  /** Hangs a rendered plate (a data URL) in an already recorded card's frame. */
  setPortrait(speciesId: string, portrait: string | null): void {
    if (!portrait) {
      return;
    }
    const image = this.entries.querySelector<HTMLImageElement>(
      `[data-species-id="${speciesId}"] .codex__portrait`,
    );
    if (image) {
      image.src = portrait;
    }
  }
}
