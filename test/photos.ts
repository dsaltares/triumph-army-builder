import sharp from 'sharp';

export type PhotoFixture = {
  width?: number;
  height?: number;
  format?: 'jpeg' | 'webp';
  grain?: boolean;
};

const flatColour = { r: 180, g: 40, b: 20 };

export const photoBytes = async ({
  width = 1200,
  height = 900,
  format = 'jpeg',
  grain = false,
}: PhotoFixture = {}) => {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: flatColour,
      ...(grain
        ? { noise: { type: 'gaussian' as const, mean: 128, sigma: 40 } }
        : {}),
    },
  });
  const encoded =
    format === 'webp' ? image.webp() : image.jpeg({ quality: 90 });
  return new Uint8Array(await encoded.toBuffer());
};

export const photoFile = async (name: string, fixture: PhotoFixture = {}) =>
  new File([await photoBytes(fixture)], name, {
    type: fixture.format === 'webp' ? 'image/webp' : 'image/jpeg',
  });
