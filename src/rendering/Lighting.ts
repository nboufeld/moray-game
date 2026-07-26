import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Vector3,
  type Scene,
} from "three";

/**
 * Where the sun sits, shared rather than repeated. The backdrop's bright lobe,
 * the light shafts and the shadow direction all derive from this one vector; if
 * any of them carried its own copy the frame would show light arriving from a
 * sun the sky does not have.
 */
export const SUN_POSITION = new Vector3(17, 24, 13);

/**
 * A deliberately simple lighting vocabulary: one warm "sun" raking down through
 * the surface, a hemisphere that carries both the blue of the water above and
 * the bounce off the bright sand below, and an ambient whose *colour* is the
 * point. Additional lights add rendering cost, so painted materials are
 * expected to carry much of the mood.
 *
 * The balance is fill-heavy on purpose, which is the opposite of a photographic
 * key. In shallow water lit through a moving surface the water itself is the
 * source: light arrives from everywhere, and a shadow is not an absence of
 * light but a *different, cooler* light. So the sun is only strong enough to
 * pick a lit plane out from an unlit one, and the fill it is measured against
 * is large, bright, and split — cyan sky, warm sand bounce, violet ambient.
 *
 * The violet is what makes a shadow read as painted rather than as unlit. A
 * shadow side here receives sky and ambient only, so their combined hue *is*
 * the hue of every shadow in the frame; a blue-violet fill lands shadows on the
 * cool side of the sand's warmth without ever letting them approach black.
 */
export class Lighting {
  readonly group = new Group();
  readonly sun: DirectionalLight;

  constructor() {
    // Off-axis rather than straight overhead: a steep sun is physically right
    // for shallow water but leaves everything flat and shadowless.
    // It only has to separate a lit plane from an unlit one by a step of value,
    // not to carry the exposure — but it is also the only warm light that
    // reaches an up-facing surface, so it is what keeps the sand a cream and
    // not an olive. Both halves of that are why it landed here and not lower:
    // at 1.15 the shadow read was right and the floor had gone green.
    this.sun = new DirectionalLight(0xfff0c6, 1.5);
    this.sun.position.copy(SUN_POSITION);
    this.sun.castShadow = true;
    // 1024 over a frustum this tight resolves contact shadows well; 2048 cost
    // four times as much shadow fill for no visible gain at this scale.
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    // Tight to the play area — a wide frustum spends its texels on empty sand.
    this.sun.shadow.camera.left = -24;
    this.sun.shadow.camera.right = 24;
    this.sun.shadow.camera.top = 24;
    this.sun.shadow.camera.bottom = -24;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;

    // Warm ground colour is the sand bouncing light back up, which is what
    // keeps the undersides of the rocks and morays from reading as black. The
    // sky half is a pale aqua rather than a deep blue: it stands for the whole
    // luminous ceiling of water, not for a slice of dark sea.
    //
    // It is held well below the ambient below it, which is not what the fill
    // budget wants but is what the shadows want. A hemisphere's sky colour
    // lands on every *up-facing* surface, so it falls on the whole seabed —
    // turn it up far enough to be the fill and the sand goes the colour of the
    // sky, and a cast shadow on it is merely that same cyan with the sun taken
    // away. The violet has to be the larger half for a shadow to be violet.
    const hemisphere = new HemisphereLight(0xa9dfe8, 0xf7dfae, 0.44);
    // Omnidirectional and blue-violet — red *above* green, which is the whole
    // difference between a violet and the ordinary cool blue a water scene
    // falls into on its own. It reaches the faces the hemisphere's two poles
    // miss, it is the only light inside a shadow that the sky does not also
    // supply, and it is the floor under every value in the frame.
    const ambient = new AmbientLight(0xb083dd, 0.8);

    this.group.add(this.sun, this.sun.target, hemisphere, ambient);
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }
}
