import { shrunkDimensions } from '@/lib/domain/collection/photos';

const uploadQuality = 0.85;

const encodeCanvas = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, uploadQuality),
  );

const decode = async (file: File) => {
  if (typeof createImageBitmap !== 'function') {
    return undefined;
  }
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return undefined;
  }
};

const drawShrunk = (bitmap: ImageBitmap) => {
  const { width, height } = shrunkDimensions(bitmap);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
};

const encodeShrunk = async (canvas: HTMLCanvasElement) => {
  const webp = await encodeCanvas(canvas, 'image/webp');
  if (webp?.type === 'image/webp') {
    return webp;
  }
  // Safari's canvas cannot encode WebP and hands back a PNG, which is larger
  // than the original photo, so it gets a JPEG instead.
  return encodeCanvas(canvas, 'image/jpeg');
};

export const shrinkPhoto = async (file: File): Promise<Blob> => {
  const bitmap = await decode(file);
  if (!bitmap) {
    return file;
  }
  try {
    const canvas = drawShrunk(bitmap);
    const shrunk = canvas && (await encodeShrunk(canvas));
    return shrunk && shrunk.size < file.size ? shrunk : file;
  } finally {
    bitmap.close();
  }
};
