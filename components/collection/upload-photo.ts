import { z } from 'zod';
import { photoUploadPath } from '@/components/collection/photo-urls';

const uploadedSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  position: z.number(),
  width: z.number(),
  height: z.number(),
});

const refusalSchema = z.object({
  error: z.string(),
  limit: z.number().optional(),
});

export type PhotoUploadError = Error & { limit?: number };

export type PhotoUpload = {
  entryId: string;
  photo: Blob;
  onProgress: (fraction: number) => void;
};

const uploadFailed = (): PhotoUploadError => new Error('photoUploadFailed');

const parsed = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const refusal = (body: unknown): PhotoUploadError => {
  const refused = refusalSchema.safeParse(body);
  if (!refused.success) {
    return uploadFailed();
  }
  const { error, limit } = refused.data;
  return Object.assign(new Error(error), limit === undefined ? {} : { limit });
};

const fileName = (photo: Blob) =>
  photo instanceof File
    ? photo.name
    : `photo.${photo.type.split('/')[1] ?? 'webp'}`;

export const uploadPhoto = ({ entryId, photo, onProgress }: PhotoUpload) =>
  new Promise<z.infer<typeof uploadedSchema>>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', new URL(photoUploadPath, window.location.href));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onload = () => {
      const body = parsed(request.responseText);
      const uploaded = uploadedSchema.safeParse(body);
      if (request.status === 201 && uploaded.success) {
        resolve(uploaded.data);
      } else {
        reject(refusal(body));
      }
    };
    request.onerror = () => reject(uploadFailed());
    const form = new FormData();
    form.append('entryId', entryId);
    form.append('photo', photo, fileName(photo));
    request.send(form);
  });
