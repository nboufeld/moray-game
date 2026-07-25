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
 * the bounce off the bright sand below, and a little ambient to keep the deep
 * shadows from going dead. Additional lights add rendering cost, so painted
 * materials are expected to carry much of the mood.
 *
 * The balance is deliberately key-heavy. Fill light is what flattens a frame:
 * with a generous hemisphere and ambient every surface got lit from every
 * direction, so nothing had a shadow side and the whole reef sat in one band of
 * midtones. The sun does most of the work now and what fill remains is cold, so
 * the side of a rock facing away from the sun goes blue and dark rather than
 * grey and merely dimmer.
 */
export class Lighting {
  readonly group = new Group();
  readonly sun: DirectionalLight;

  constructor() {
    // Off-axis rather than straight overhead: a steep sun is physically right
    // for shallow water but leaves everything flat and shadowless.
    // Strong enough that a sunlit face lands above the grade's contrast pivot
    // while a shadow side stays below it. That crossing is what turns one light
    // into two value groups; at half this the whole reef sat on one side of the
    // pivot and every grade adjustment moved all of it together.
    this.sun = new DirectionalLight(0xfff1d0, 2.1);
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
    // sky half is colder than the water it stands in on purpose: it is the only
    // light a shadow side receives, so its hue is the hue of every shadow.
    const hemisphere = new HemisphereLight(0x7fb8cc, 0xc2a172, 0.38);
    const ambient = new AmbientLight(0x2f6b78, 0.1);

    this.group.add(this.sun, this.sun.target, hemisphere, ambient);
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }
}
