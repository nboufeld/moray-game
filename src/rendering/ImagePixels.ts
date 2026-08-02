import { CanvasTexture, type Texture } from "three";

/**
 * The narrow bit of the DOM that lets an authored image be *read* rather than
 * only uploaded.
 *
 * Three hands a loaded texture over as pixels bound for the GPU, and three of
 * the painted assets need a look at them on the way past: the backdrop's
 * horizon colour becomes the fog colour, the sand wash's ripples are opened up
 * before they are laid on the largest surface in the frame, and the grass strip
 * is unpacked from its black field. All three are one-off transforms at load
 * time, not per-frame work.
 *
 * Two properties make this safe to depend on. It is inert without a `document`,
 * like {@link module:AssetLibrary} itself, so the Node unit tests never reach
 * it. And a 1:1 `drawImage` followed by `getImageData` is an exact copy of the
 * decoded file — no resampling, no filtering — so what comes back is the
 * painting, and two runs of the same browser agree to the bit. That last part
 * is the whole reason nothing here scales an image while reading it.
 */

/** Anything three's `TextureLoader` might have put in `texture.image`. */
interface DecodedImage {
  readonly width: number;
  readonly height: number;
}

function isDecoded(image: unknown): image is DecodedImage & CanvasImageSource {
  if (typeof document === "undefined" || image === null || typeof image !== "object") {
    return false;
  }
  const candidate = image as DecodedImage;
  return candidate.width > 0 && candidate.height > 0;
}

function context(width: number, height: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d", { willReadFrequently: true });
}

/**
 * A rectangle of a loaded texture's image, in image pixels, or null if there is
 * no DOM or the image never arrived.
 *
 * `rows` runs down from `top` the way image rows do, which is the opposite of
 * the way a texture's `v` runs. Callers converting from `v` do it themselves,
 * because whether that flip applies depends on the texture's own `flipY`.
 */
export function readImageRows(texture: Texture, top: number, rows: number): ImageData | null {
  const image: unknown = texture.image;
  if (!isDecoded(image)) {
    return null;
  }

  const height = Math.min(rows, image.height);
  const y = Math.max(0, Math.min(image.height - height, Math.round(top)));
  const ctx = context(image.width, height);
  if (!ctx) {
    return null;
  }

  ctx.drawImage(image, 0, y, image.width, height, 0, 0, image.width, height);
  return ctx.getImageData(0, 0, image.width, height);
}

/** Every pixel of a loaded texture's image, or null as {@link readImageRows}. */
export function readImage(texture: Texture): ImageData | null {
  const image: unknown = texture.image;
  return isDecoded(image) ? readImageRows(texture, 0, image.height) : null;
}

/**
 * Wraps transformed pixels back into a texture, carrying over the sampling the
 * asset library set up for the original.
 *
 * The source is left alone: it is cached by path and shared, so a transform is
 * always a second texture rather than an edit. They do not share a `Source`,
 * so this is a second upload — which is why every caller memoises its result
 * instead of remapping per instance.
 */
export function textureFromPixels(pixels: ImageData, like: Texture): CanvasTexture | null {
  const ctx = context(pixels.width, pixels.height);
  if (!ctx) {
    return null;
  }
  ctx.putImageData(pixels, 0, 0);

  const texture = new CanvasTexture(ctx.canvas);
  texture.flipY = like.flipY;
  texture.colorSpace = like.colorSpace;
  texture.wrapS = like.wrapS;
  texture.wrapT = like.wrapT;
  texture.generateMipmaps = like.generateMipmaps;
  texture.minFilter = like.minFilter;
  texture.magFilter = like.magFilter;
  texture.anisotropy = like.anisotropy;
  texture.needsUpdate = true;
  return texture;
}
