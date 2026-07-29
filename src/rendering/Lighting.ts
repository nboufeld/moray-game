import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Vector3,
  type Scene,
} from "three";
import { ABYSS_LIGHT, abyssMood, onSceneRender } from "../world/Abyss";
import { wingMoodAt } from "../world/wings/WingField";
import { regionMoodAt } from "../world/regions/RegionField";
import type { WingMoodTables } from "../world/wings/WingTypes";
import type { WeatherMoods } from "./WeatherMoods";

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

  private readonly hemisphere: HemisphereLight;
  private readonly ambient: AmbientLight;
  /** The rig's shipped levels; the twilight hook scales down from these. */
  private readonly baseLevels = { sun: 0, hemisphere: 0, ambient: 0 };
  /** The key's shipped colour, so a mood's tint always multiplies the base. */
  private readonly baseSunColor = new Color();
  /** The sky's slow moods (W-M1); null — and identity — everywhere but the reef. */
  private weather: WeatherMoods | null = null;
  /** Whether a mood has written the key's colour, so identity restores it once. */
  private tinted = false;

  constructor() {
    // Off-axis rather than straight overhead: a steep sun is physically right
    // for shallow water but leaves everything flat and shadowless.
    // It only has to separate a lit plane from an unlit one by a step of value,
    // not to carry the exposure — but it is also the only warm light that
    // reaches an up-facing surface, so it is what keeps the sand a cream and
    // not an olive. Both halves of that are why it landed here and not lower:
    // at 1.15 the shadow read was right and the floor had gone green.
    //
    // It went up a little when the reef became ramp-shaded, and the ambient
    // came down to pay for it. A ramp is a *ratio* between bands, so the key is
    // the only thing that decides how far apart the steps land: the fill lands
    // on every band equally and can only close them up. It is a small move on
    // purpose, because a ramp also *hands the whole key* to any plane in its top
    // band rather than that plane's own cosine — the seabed used to take 75% of
    // this light and now takes all of it, so anything more here brightens the
    // largest surface in the frame far faster than it opens the steps.
    this.sun = new DirectionalLight(0xfff0c6, 1.6);
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
    this.hemisphere = new HemisphereLight(0xa9dfe8, 0xf7dfae, 0.44);
    const hemisphere = this.hemisphere;
    // Omnidirectional and blue-violet — red *above* green, which is the whole
    // difference between a violet and the ordinary cool blue a water scene
    // falls into on its own. It reaches the faces the hemisphere's two poles
    // miss, it is the only light inside a shadow that the sky does not also
    // supply, and it is the floor under every value in the frame.
    // Down from 0.8 with the key's rise, which keeps the frame mean near where
    // it was: a ramp's shade band is a floor under the key, so the fill no
    // longer has to hold the shadows up on its own.
    this.ambient = new AmbientLight(0xb083dd, 0.74);
    const ambient = this.ambient;

    this.group.add(this.sun, this.sun.target, hemisphere, ambient);
    this.baseLevels.sun = this.sun.intensity;
    this.baseLevels.hemisphere = hemisphere.intensity;
    this.baseLevels.ambient = ambient.intensity;
    this.baseSunColor.copy(this.sun.color);
  }

  /** Opts the rig into the sky's slow moods (W-M1). Only the reef attaches. */
  attachWeather(weather: WeatherMoods): void {
    this.weather = weather;
  }

  addTo(scene: Scene): void {
    scene.add(this.group);

    // W-M3: the twilight takes the key down as the camera descends into the
    // canyon — scarce light is the second biome's whole argument — while the
    // violet ambient keeps most of its floor, so the place darkens into
    // colour rather than into black. Positional, eased by `abyssMood`'s own
    // ramps, and *exactly* the shipped rig at a mood of zero: each intensity
    // is base × (1 − share × 0), which is base to the bit, so every in-bowl
    // frame is lit by arithmetic this hook never touches. Reduced motion
    // needs nothing here — nothing is animated, only positioned.
    // W-M1 layers the sky's slow moods over the same hook, by the standing
    // composition rule: the weather scales the base and the twilight
    // modulates the scaled base. With no weather attached, or at the identity
    // mood, the arithmetic below is W-M3's shipped expression untouched — and
    // the key wears its shipped colour, restored once on the way back to
    // identity rather than rewritten every frame.
    onSceneRender(scene, (camera) => {
      const position = camera.position;
      // Wave 8: a wing's mood is the same channel as the twilight's — the
      // canyon and the wings are azimuthally disjoint, so at most one is
      // nonzero, the canyon's arithmetic passes through unchanged, and at
      // zero everywhere the shipped rig is written back to the bit.
      let mood = abyssMood(position.x, position.y, position.z);
      let shares: WingMoodTables["light"] = ABYSS_LIGHT;
      if (mood === 0) {
        const wing = wingMoodAt(position.x, position.y, position.z);
        if (wing !== null) {
          mood = wing.mood;
          shares = wing.tables.light;
        } else {
          // R0: the regions — the third place channel, one writer still.
          const region = regionMoodAt(position.x, position.y, position.z);
          if (region !== null) {
            mood = region.mood;
            shares = region.tables.light;
          }
        }
      }
      const weather =
        this.weather !== null && !this.weather.isIdentity ? this.weather.channels : null;
      if (weather === null) {
        this.sun.intensity = this.baseLevels.sun * (1 - shares.sun * mood);
        this.hemisphere.intensity =
          this.baseLevels.hemisphere * (1 - shares.hemisphere * mood);
        this.ambient.intensity = this.baseLevels.ambient * (1 - shares.ambient * mood);
        if (this.tinted) {
          this.sun.color.copy(this.baseSunColor);
          this.tinted = false;
        }
        return;
      }
      this.sun.intensity = this.baseLevels.sun * weather.sun * (1 - shares.sun * mood);
      this.hemisphere.intensity =
        this.baseLevels.hemisphere * weather.hemisphere * (1 - shares.hemisphere * mood);
      this.ambient.intensity =
        this.baseLevels.ambient * weather.ambient * (1 - shares.ambient * mood);
      this.sun.color.setRGB(
        this.baseSunColor.r * weather.sunRed,
        this.baseSunColor.g * weather.sunGreen,
        this.baseSunColor.b * weather.sunBlue,
      );
      this.tinted = true;
    });
  }
}
