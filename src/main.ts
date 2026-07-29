import { Game } from "./app/Game";
import { REGIONS } from "./world/regions/RegionRegistry";
import "./style.css";

const canvas = document.getElementById("reef-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #reef-canvas element");
}

const resetSave = new URLSearchParams(window.location.search).has("reset");
const game = new Game(canvas, { resetSave });
game.start();

// Expose for lightweight end-to-end assertions. The soundscape gets its own
// handle because sound is the one thing a screenshot cannot review: the probe
// reads the graph's shape and levels back off it instead.
(window as unknown as { __reef?: Game }).__reef = game;
(window as unknown as { __reefAudio?: Game["audio"] }).__reefAudio = game.audio;
// R0: the region capture harness reads pose tables straight out of the
// running module graph, so the script and the game cannot disagree.
(window as unknown as { __reefRegions?: { defs: typeof REGIONS } }).__reefRegions = {
  defs: REGIONS,
};
