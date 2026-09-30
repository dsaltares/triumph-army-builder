import sharp, { type Sharp } from 'sharp';

export const photoSizes = {
  display: { longEdge: 1600, quality: 80 },
  thumb: { longEdge: 400, quality: 75 },
} as const;

export type PhotoSize = keyof typeof photoSizes;

export const maxInputPixels = 48_000_000;

const acceptedFormats = new Set(['jpeg', 'png', 'webp', 'heif', 'gif', 'tiff']);

export type EncodedImage = {
  bytes: Buffer;
  width: number;
  height: number;
};

export type EncodedPhoto = Record<PhotoSize, EncodedImage>;

export type PhotoRefusal = 'not-an-image' | 'too-many-pixels';

export type EncodeResult =
  | { encoded: true; photo: EncodedPhoto }
  | { encoded: false; refusal: PhotoRefusal };

export type EncodeOptions = {
  maxPixels?: number;
};

const refuse = (refusal: PhotoRefusal): EncodeResult => ({
  encoded: false,
  refusal,
});

const readHeader = async (bytes: Uint8Array) => {
  try {
    return await sharp(bytes, { limitInputPixels: false }).metadata();
  } catch {
    return undefined;
  }
};

const encodeAt = async (image: Sharp, size: PhotoSize) => {
  const { longEdge, quality } = photoSizes[size];
  const { data, info } = await image
    .clone()
    .resize({
      width: longEdge,
      height: longEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
};

export const encodePhoto = async (
  bytes: Uint8Array,
  { maxPixels = maxInputPixels }: EncodeOptions = {},
): Promise<EncodeResult> => {
  const metadata = await readHeader(bytes);
  if (!metadata?.format || !acceptedFormats.has(metadata.format)) {
    return refuse('not-an-image');
  }
  const pageHeight = metadata.pageHeight ?? metadata.height;
  if (metadata.width * pageHeight > maxPixels) {
    return refuse('too-many-pixels');
  }
  try {
    const oriented = sharp(bytes, { limitInputPixels: maxPixels }).rotate();
    const [display, thumb] = await Promise.all([
      encodeAt(oriented, 'display'),
      encodeAt(oriented, 'thumb'),
    ]);
    return { encoded: true, photo: { display, thumb } };
  } catch {
    return refuse('not-an-image');
  }
};
