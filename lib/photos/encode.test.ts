import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { type EncodeResult, encodePhoto, photoSizes } from './encode.ts';

const red = { r: 255, g: 0, b: 0 };
const blue = { r: 0, g: 0, b: 255 };

const solid = (width: number, height: number, background = blue) =>
  sharp({ create: { width, height, channels: 3, background } });

const encoded = (result: EncodeResult) => {
  if (!result.encoded) {
    throw new Error(`Refused: ${result.refusal}`);
  }
  return result.photo;
};

const pixelAt = async (bytes: Buffer, left: number, top: number) => {
  const { data, info } = await sharp(bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const offset = (top * info.width + left) * info.channels;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
};

describe('encodePhoto', () => {
  it('writes a display and a thumb as WebP within their long edges', async () => {
    const photo = encoded(
      await encodePhoto(await solid(3200, 2400).jpeg().toBuffer()),
    );

    expect(photo.display).toMatchObject({ width: 1600, height: 1200 });
    expect(photo.thumb).toMatchObject({ width: 400, height: 300 });
    for (const image of [photo.display, photo.thumb]) {
      const metadata = await sharp(image.bytes).metadata();
      expect(metadata).toMatchObject({
        format: 'webp',
        width: image.width,
        height: image.height,
      });
    }
  });

  it('sizes a portrait photo by its height', async () => {
    const photo = encoded(
      await encodePhoto(await solid(1200, 2400).png().toBuffer()),
    );

    expect(photo.display).toMatchObject({ width: 800, height: 1600 });
    expect(photo.thumb).toMatchObject({ width: 200, height: 400 });
  });

  it('never enlarges a photo smaller than a size', async () => {
    const photo = encoded(
      await encodePhoto(await solid(300, 200).webp().toBuffer()),
    );

    expect(photo.display).toMatchObject({ width: 300, height: 200 });
    expect(photo.thumb).toMatchObject({ width: 300, height: 200 });
  });

  it('uses the quality each size is given', async () => {
    const source = await solid(2000, 1500).jpeg().toBuffer();
    const photo = encoded(await encodePhoto(source));

    const atQuality = (quality: number, longEdge: number) =>
      sharp(source)
        .resize({ width: longEdge, height: longEdge, fit: 'inside' })
        .webp({ quality })
        .toBuffer();

    expect(photo.display.bytes.length).toBe(
      (await atQuality(photoSizes.display.quality, photoSizes.display.longEdge))
        .length,
    );
    expect(photo.thumb.bytes.length).toBe(
      (await atQuality(photoSizes.thumb.quality, photoSizes.thumb.longEdge))
        .length,
    );
  });

  it('strips EXIF, including GPS, and every other kind of metadata', async () => {
    const source = await solid(640, 480)
      .withExif({
        IFD0: { Copyright: 'Kept private', Make: 'PhoneCo' },
        IFD3: { GPSMapDatum: 'WGS-84-secret-spot' },
      })
      .withIccProfile('p3')
      .jpeg()
      .toBuffer();
    const { exif } = await sharp(source).metadata();
    expect(exif?.toString('latin1')).toContain('WGS-84-secret-spot');

    const photo = encoded(await encodePhoto(source));

    for (const image of [photo.display, photo.thumb]) {
      const metadata = await sharp(image.bytes).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(metadata.iptc).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      const text = image.bytes.toString('latin1');
      expect(text).not.toContain('WGS-84-secret-spot');
      expect(text).not.toContain('Kept private');
      expect(text).not.toContain('PhoneCo');
    }
  });

  it('turns the pixels the way the EXIF orientation says, then drops it', async () => {
    const redLeftHalf = await solid(100, 100, red).png().toBuffer();
    const stored = await solid(200, 100)
      .composite([{ input: redLeftHalf, left: 0, top: 0 }])
      .jpeg()
      .toBuffer();
    const rotatedClockwise = await sharp(stored)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const photo = encoded(await encodePhoto(rotatedClockwise));

    expect(photo.display).toMatchObject({ width: 100, height: 200 });
    const top = await pixelAt(photo.display.bytes, 50, 20);
    const bottom = await pixelAt(photo.display.bytes, 50, 180);
    expect(top.r).toBeGreaterThan(200);
    expect(top.b).toBeLessThan(60);
    expect(bottom.b).toBeGreaterThan(200);
    expect(bottom.r).toBeLessThan(60);
  });

  it('refuses a photo over the pixel limit', async () => {
    const source = await solid(200, 100).jpeg().toBuffer();

    expect(await encodePhoto(source, { maxPixels: 19_999 })).toEqual({
      encoded: false,
      refusal: 'too-many-pixels',
    });
    expect((await encodePhoto(source, { maxPixels: 20_000 })).encoded).toBe(
      true,
    );
  });

  it('refuses bytes that are not an image', async () => {
    expect(await encodePhoto(Buffer.from('%PDF-1.7 not a photo'))).toEqual({
      encoded: false,
      refusal: 'not-an-image',
    });
    expect(await encodePhoto(new Uint8Array())).toEqual({
      encoded: false,
      refusal: 'not-an-image',
    });
  });

  it('refuses an SVG, which is a document and not a photo', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );

    expect(await encodePhoto(svg)).toEqual({
      encoded: false,
      refusal: 'not-an-image',
    });
  });

  it('refuses an image whose data is cut short', async () => {
    const source = await solid(640, 480).jpeg().toBuffer();
    const truncated = source.subarray(0, Math.floor(source.length / 2));

    expect(await encodePhoto(truncated)).toEqual({
      encoded: false,
      refusal: 'not-an-image',
    });
  });
});
