import {
  Box3,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  type Camera,
} from "three";
import { Moray } from "../creatures/morays/Moray";
import type { MoraySpeciesConfig } from "../creatures/morays/MoraySpeciesConfig";
import { disposeSubtree } from "../util/disposeSubtree";

/** Edge of the square portrait written into a codex card. */
export const PORTRAIT_SIZE = 256;

/** The slice of the renderer a portrait needs — the UI stays off the GL API. */
export interface PortraitRenderer {
  captureToDataUrl(scene: Scene, camera: Camera, size: number): string | null;
}

/** Three-quarter turn away from the lens, in radians. Dead-on reads as a mugshot. */
const VIEW_ANGLE = 0.5;
/**
 * How far above the head the lens sits, as a fraction of its distance. Barely:
 * a portrait taken from above is an inspection, not a meeting.
 */
const VIEW_LIFT = 0.12;
/**
 * Head bounding spheres that fit across the frame. At 1 the head exactly fills
 * it; the margin above that is all the room the body needs to leave the corner.
 */
const FRAMING = 1;
/** Simulated seconds of idling before the shutter: enough for the resting curve. */
const SETTLE_SECONDS = 1;
const STEP = 1 / 60;

const BACKDROP = 0x0c3243;
const UP = new Vector3(0, 1, 0);
/** The body runs away from the head down -Z; the rig is built along +Z. */
const BODY_AXIS = new Vector3(0, 0, -1);

/**
 * A field-guide plate of one species, rendered once and kept as a data URL.
 *
 * The codex has always promised an illustrated guide and shown three lines of
 * text. This is the illustration: the same animal the player found, in the
 * light the reef never gives it — a warm key across the face, a cool rim to cut
 * it off the backdrop, and a short fog so the body falls away behind the head
 * instead of running out of the frame.
 *
 * Everything it builds is thrown away before it returns, and it runs once per
 * species — but it is not cheap enough to call from anywhere. See
 * `Game.renderNextPortrait` for where it is allowed to happen.
 */
export function renderMorayPortrait(
  renderer: PortraitRenderer,
  config: MoraySpeciesConfig,
  size: number = PORTRAIT_SIZE,
): string | null {
  const scene = new Scene();
  scene.background = new Color(BACKDROP);

  const moray = new Moray(config);
  scene.add(moray.asset.root);

  // Where the lens will be, in the animal's own space: it has to be known
  // before the pose so the eyes can find it, and the framing needs the pose.
  const view = new Vector3(Math.sin(VIEW_ANGLE), VIEW_LIFT, Math.cos(VIEW_ANGLE)).normalize();

  const lookTarget = view.clone().multiplyScalar(2);
  for (let elapsed = 0; elapsed < SETTLE_SECONDS; elapsed += STEP) {
    moray.update(STEP, lookTarget, true);
  }
  moray.asset.root.updateMatrixWorld(true);

  const head = new Box3().setFromObject(moray.asset.head).getBoundingSphere(new Sphere());
  // Aimed a little down the body rather than at the head alone: the animal is
  // a diagonal across the card, and centring one end of it leaves the other
  // end's worth of empty water opposite.
  const focus = head.center.clone().addScaledVector(BODY_AXIS, head.radius * 0.25);
  const camera = new PerspectiveCamera(32, 1, 0.05, 40);
  const distance = (head.radius * FRAMING) / Math.tan((camera.fov * Math.PI) / 360);
  camera.position.copy(focus).addScaledVector(view, distance);
  camera.lookAt(focus);

  // Opens just behind the head and closes over the tail, so the body falls
  // away into the card instead of running out of the bottom of it.
  scene.fog = new Fog(BACKDROP, distance + head.radius, distance + head.radius * 10);

  // Lights are placed in the camera's own frame rather than in world axes, so
  // the rig reads as "key over the left shoulder, rim behind the right" no
  // matter which way the animal happens to be pointing.
  const right = new Vector3().crossVectors(view, UP).normalize();
  const lift = new Vector3().crossVectors(right, view).normalize();
  const place = (light: DirectionalLight, along: number, across: number, above: number): void => {
    light.position
      .copy(focus)
      .addScaledVector(view, distance * along)
      .addScaledVector(right, distance * across)
      .addScaledVector(lift, distance * above);
    light.target.position.copy(focus);
    scene.add(light, light.target);
  };

  const key = new DirectionalLight(0xffe4bd, 2.8);
  place(key, 0.7, -0.9, 0.75);
  const rim = new DirectionalLight(0x9adcf2, 2.4);
  place(rim, -0.8, 0.85, 0.45);
  scene.add(new HemisphereLight(0x7fc4dc, 0x0a2b38, 0.55));

  try {
    return renderer.captureToDataUrl(scene, camera, size);
  } finally {
    scene.remove(moray.asset.root);
    disposeSubtree(moray.asset.root);
  }
}
