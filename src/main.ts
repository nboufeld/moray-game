import { Game } from "./app/Game";
import "./style.css";

const canvas = document.getElementById("reef-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #reef-canvas element");
}

const resetSave = new URLSearchParams(window.location.search).has("reset");
const game = new Game(canvas, { resetSave });
game.start();

// Expose for lightweight end-to-end assertions.
(window as unknown as { __reef?: Game }).__reef = game;
