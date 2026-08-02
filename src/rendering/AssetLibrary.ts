/// <reference types="vite/client" />
import {
  ClampToEdgeWrapping,
  EquirectangularReflectionMapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

/**
 * What has arrived, per path. Two caches because there are two kinds of thing
 * on disk now, and one lookup table would have to be widened at every use.
 */
/**
 * What has arrived and who is waiting for it, per kind of asset.
 *
 * A pair of maps per kind rather than one pair of wider ones: a path is a
 * texture or a model for the whole life of the process, and keeping them apart
 * is what lets {@link fetchAsset} stay generic without a cast at either end.
 */
interface AssetKind<T> {
  readonly ready: Map<string, T>;
  readonly waiting: Map<string, ((value: T) => void)[]>;
}

const textures: AssetKind<Texture> = { ready: new Map(), waiting: new Map() };
const models: AssetKind<BufferGeometry> = { ready: new Map(), waiting: new Map() };

const failed = new Set<string>();
/** One entry per request in flight; see {@link whenAssetsSettled}. */
const inFlight = new Map<string, Promise<void>>();

let textureLoader: TextureLoader | null = null;
let modelLoader: GLTFLoader | null = null;

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
   * For terrain maps that repeat many times across a surface: `v` wraps as well
   * as `u`, so the tile can be laid in a grid.
   *
   * It used to mirror, on the argument that a generated image never wraps
   * perfectly and mirroring makes every edge seamless by construction. That
   * argument was never tested and it does not survive being tested: the painted
   * washes wrap to within about one part in 255 — measured as the step across
   * the join against the step between neighbouring columns inside the image —
   * which is under the frame's own dither.
   *
   * What mirroring costs, meanwhile, is visible. A mirror is only invisible on
   * material with no direction in it, and a wash of ripples is nothing but
   * direction: every band turns around at the join, which reads as a crease
   * down the seabed at exactly the spacing of the tile. Plain repeat has no
   * crease and pays for it with a pattern that recurs at one tile instead of
   * two — cheap, in an image whose whole content is soft broad marks.
   */
  readonly tile?: boolean;
}

export function requestAlbedo(
  assetPath: string,
  onReady: (texture: Texture) => void,
  options?: AlbedoOptions,
): void {
  fetchAsset(textures, assetPath, onReady, (url, deliver, fail) => {
    textureLoader ??= new TextureLoader();
    textureLoader.load(
      url,
      (texture) => {
        configureAlbedo(texture, options?.tile === true);
        deliver(texture);
      },
      undefined,
      fail,
    );
  });
}

/**
 * Asks for a built model, delivering its geometry when it arrives.
 *
 * Same contract as {@link requestAlbedo}, one asset class over: the caller
 * keeps whatever geometry it already had until this returns, a failure leaves
 * it there forever, and nothing happens at all without a `window`. What that
 * buys is a hero coral that is a `CoralShapes` fallback in the unit tests, a
 * `CoralShapes` fallback in the `SHOT_NO_ASSETS` build, and a Blender piece in
 * the game — all three built by the same constructor, none of them a branch.
 *
 * Only the geometry crosses over. A GLB can carry a material and this one
 * deliberately does not: every lit surface in the project comes out of
 * `createToonMaterial`, so a material from disk would be the one thing in the
 * reef not reading the shared ramp. The pieces are exported with no UVs and no
 * material for that reason, and what they *do* carry — `COLOR_0` — is a
 * measured linear multiplier; see `tools/blender/coral_common.py`.
 *
 * The geometry is cached per path and handed to every caller, which makes it
 * the library's to own exactly as the textures are: an `InstancedMesh` that
 * takes one must not dispose it.
 *
 * @param assetPath Path under `public/assets/`, e.g. `models/coral-brain.glb`.
 */
export function requestModel(assetPath: string, onReady: (geometry: BufferGeometry) => void): void {
  fetchAsset(models, assetPath, onReady, (url, deliver, fail) => {
    modelLoader ??= new GLTFLoader();
    modelLoader.load(
      url,
      (gltf) => {
        const geometry = extractGeometry(gltf.scene);
        if (geometry) {
          deliver(geometry);
        } else {
          fail();
        }
      },
      undefined,
      fail,
    );
  });
}

/**
 * Takes the first mesh's geometry out of a loaded scene, in world space.
 *
 * The build scripts export one mesh, but they export it through Blender's
 * scene graph, which is free to hang it under a transform — so the node's
 * world matrix is baked in rather than trusted to be identity. Everything else
 * the file brought is dropped here: the loader builds a `MeshStandardMaterial`
 * per primitive whether or not the GLB declared one, and nothing in this
 * project renders one of those.
 */
function extractGeometry(scene: Object3D): BufferGeometry | null {
  let found: BufferGeometry | null = null;
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    const geometry = node.geometry as BufferGeometry;
    if (!found) {
      geometry.applyMatrix4(node.matrixWorld);
      // An `InstancedMesh` culls on the geometry's bounding sphere, and the
      // loader only computes one lazily on first raycast.
      geometry.computeBoundingSphere();
      found = geometry;
    } else {
      geometry.dispose();
    }
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      (material as Material).dispose();
    }
  });
  return found;
}

/**
 * Asks for the painted water column that hangs behind everything.
 *
 * Same delivery contract as {@link requestAlbedo} — the gradient backdrop stays
 * up until this lands, and stays up forever if it never does — but a different
 * sampling one, because this image is not a surface. It is an equirectangular
 * panorama, so `flipY` keeps the loader's default: unlike a moray skin, whose
 * `v` is authored to a body, a panorama's `v` is up, and three's own
 * `equirectUv` reads `v = 1` overhead. The image is painted surface-at-the-top,
 * which is what a flipped upload puts there.
 *
 * No mipmaps, and `LinearFilter` with them. Three does not sample an equirect
 * background directly: `WebGLCubeMaps` renders it once into a cube target the
 * height of the source image and samples that from then on, at roughly one
 * texel per texel. A mip chain on the source would be built, uploaded and never
 * read.
 */
export function requestBackdrop(assetPath: string, onReady: (texture: Texture) => void): void {
  fetchAsset(textures, assetPath, onReady, (url, deliver, fail) => {
    textureLoader ??= new TextureLoader();
    textureLoader.load(
      url,
      (texture) => {
        configureBackdrop(texture);
        deliver(texture);
      },
      undefined,
      fail,
    );
  });
}

/**
 * The shared half of every request: the cache, the queue, the in-flight
 * bookkeeping and the promise that a failure is not an error.
 *
 * `begin` is the only part that differs between an image and a model, and it
 * is handed a `deliver`/`fail` pair rather than being allowed to touch any of
 * the above — which is what keeps "a missing file leaves the caller exactly
 * where it was" a property of this function rather than of each loader.
 */
function fetchAsset<T>(
  kind: AssetKind<T>,
  assetPath: string,
  onReady: (value: T) => void,
  begin: (url: string, deliver: (value: T) => void, fail: () => void) => void,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const ready = kind.ready.get(assetPath);
  if (ready) {
    onReady(ready);
    return;
  }
  if (failed.has(assetPath)) {
    return;
  }

  const queue = kind.waiting.get(assetPath);
  if (queue) {
    queue.push(onReady);
    return;
  }
  kind.waiting.set(assetPath, [onReady]);

  let settle = (): void => {};
  inFlight.set(
    assetPath,
    new Promise<void>((resolve) => {
      settle = resolve;
    }),
  );

  const url = `${import.meta.env.BASE_URL}${ASSET_ROOT}${assetPath}`;
  begin(
    url,
    (value) => {
      kind.ready.set(assetPath, value);
      for (const callback of kind.waiting.get(assetPath) ?? []) {
        callback(value);
      }
      kind.waiting.delete(assetPath);
      finish(assetPath, settle);
    },
    () => {
      console.warn(`[assets] ${url} did not load; keeping the procedural stand-in.`);
      failed.add(assetPath);
      kind.waiting.delete(assetPath);
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
  texture.wrapS = RepeatWrapping;
  texture.wrapT = tile ? RepeatWrapping : ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = ANISOTROPY;
  texture.needsUpdate = true;
}

/** See {@link requestBackdrop}: a panorama, not a surface. */
function configureBackdrop(texture: Texture): void {
  texture.colorSpace = SRGBColorSpace;
  texture.mapping = EquirectangularReflectionMapping;
  // Azimuth wraps and altitude does not, exactly as the gradient's does.
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
}
