export const photoUploadPath = '/api/collection/photos';

export type PhotoSize = 'display' | 'thumb';

export const photoPath = (id: string, size: PhotoSize) =>
  `${photoUploadPath}/${encodeURIComponent(id)}/${size}`;
