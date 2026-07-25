/// <reference types="vite/client" />
import {
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  MirroredRepeatWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";

/**
 * The one place authored art enters the renderer.
 *
 * Everything else here is generated (`ProceduralTexture`), and the properties
 * that made that worth doing are the ones this has to preserve: the unit tests
 * run in plain Node, and a screenshot has to be reproducible. So two rules
 * shape this module.
 *
 * It is inert without a `window`. Three's image loaders reach for `document`
 * the moment they are asked for anything, and `tests/morayAsset.test.ts` builds
 * every species — so in Node a request simply never fires its callback and the
 * caller keeps the procedural map it already had. Nothing is constructed at
 * module scope for the same reason.
 *
 * And a failure is never an error. A missing file leaves the procedural skin in
 * place and costs one `console.warn`; the reef is still a complete game with no
 * `public/` directory at all, which is the property that lets the assets be
 * added one at a time.
 *
 * Loaded textures are cached per path and shared by every user of them, exactly
 * as `MorayPattern`'s skins are — four sanctuary residents, the reef animals and
 * every codex portrait hand out the same `Texture`. They are owned by this
 * module and outlive any of them, which is why `disposeSubtree` releases
 * geometries, materials and skeletons but deliberately not maps.
 */

/** Path under `public/` that every asset here is resolved against. */
const ASSET_ROOT = "assets/";

/** Matches the procedural maps' sampling, so a swap changes only the pixels. */
const ANISOTROPY = 4;

const loaded = new Map<string, Texture>();
const failed = new Set<string>();
/** Callbacks waiting on a load that is already under way. */
const waiting = new Map<string, ((texture: Texture) => void)[]>();
/** One entry per request in flight; see {@link whenAssetsSettled}. */
const inFlight = new Map<string, Promise<void>>();

let loader: TextureLoader | null = null;

/**
 * Asks for an authored albedo map, delivering it to `onReady` when it arrives.
 *
 * Callers keep whatever map they already have until then, so this is safe to
 * call from a constructor: the animal is complete before the request is made
 * and stays complete if it never returns.
 *
 * @param assetPath Path under `public/assets/`, e.g. `creatures/skin.png`.
 */
export interface AlbedoOptions {
  /**
   * For terrain maps that repeat many times across a surface. Mirrored rather
   * than plain repeat: a generated image never wraps perfectly, and mirroring
   * makes every edge seamless by construction — invisible on isotropic
   * material like sand grain, where there is no direction to betray it.
   */
  readonly tile?: boolean;
}

export function requestAlbedo(
  assetPath: string,
  onReady: (texture: Texture) => void,
  options?: AlbedoOptions,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const ready = loaded.get(assetPath);
  if (ready) {
    onReady(ready);
    return;
  }
  if (failed.has(assetPath)) {
    return;
  }

  const queue = waiting.get(assetPath);
  if (queue) {
    queue.push(onReady);
    return;
  }
  waiting.set(assetPath, [onReady]);

  let settle = (): void => {};
  inFlight.set(
    assetPath,
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );

  const url = `${import.meta.env.BASE_URL}${ASSET_ROOT}${assetPath}`;
  loader ??= new TextureLoader();
  loader.load(
    url,
    (texture) => {
      configureAlbedo(texture, options?.tile === true);
      loaded.set(assetPath, texture);
      for (const callback of waiting.get(assetPath) ?? []) {
        callback(texture);
      }
      finish(assetPath, settle);
    },
    undefined,
    () => {
      console.warn(`[assets] ${url} did not load; keeping the procedural map.`);
      failed.add(assetPath);
      finish(assetPath, settle);
    },
  );
}

/** Whether any request is still outstanding. */
export function assetsPending(): boolean {
  return inFlight.size > 0;
}

/**
 * Resolves once every asset requested so far has loaded or failed.
 *
 * The loop re-checks rather than awaiting a snapshot: a request made *while*
 * this is waiting — a sanctuary rebuild, a codex portrait — is part of what it
 * promises to have settled.
 */
export async function whenAssetsSettled(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.all([...inFlight.values()]);
  }
}

function finish(assetPath: string, settle: () => void): void {
  waiting.delete(assetPath);
  inFlight.delete(assetPath);
  settle();
}

/**
 * The sampling contract an authored albedo has to meet to stand in for a
 * procedural one.
 *
 * `flipY` is the load-bearing line. Three's `TextureLoader` flips by default,
 * because the usual case is a picture on a quad and the usual quad has `v = 0`
 * along its bottom edge. A moray is not that: `MorayBody` runs `v = 0` at the
 * snout and `v = 1` at the tail tip, and the maps are painted with the head on
 * the image's *top* row. Flipped, `v = 0` samples the bottom row and every eel
 * wears its tail on its face. Unflipped, the image's rows land where they were
 * painted — which is also exactly what the `DataTexture`s this replaces do,
 * since `DataTexture` does not flip either.
 *
 * `u` wraps the circumference (0 the belly, 0.5 the spine, 1 the belly again),
 * so `wrapS` repeats. `v` does not wrap — the head and the tail are not
 * neighbours — so `wrapT` clamps rather than blending one into the other.
 */
function configureAlbedo(texture: Texture, tile: boolean): void {
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = tile ? MirroredRepeatWrapping : RepeatWrapping;
  texture.wrapT = tile ? MirroredRepeatWrapping : ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = ANISOTROPY;
  texture.needsUpdate = true;
}
