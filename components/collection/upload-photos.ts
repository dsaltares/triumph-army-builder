import { shrinkPhoto } from '@/components/collection/shrink-photo';
import { uploadPhoto } from '@/components/collection/upload-photo';
import {
  type PhotoRoom,
  photoLimitReached,
} from '@/lib/domain/collection/photos';

export type PhotoUploading =
  | { stage: 'preparing' }
  | { stage: 'uploading'; progress: number };

export type PhotoUploads = {
  entryId: string;
  files: readonly File[];
  room: PhotoRoom;
  onUploading: (uploading: PhotoUploading) => void;
};

export const uploadPhotos = async ({
  entryId,
  files,
  room,
  onUploading,
}: PhotoUploads) => {
  let { onEntry, onAccount } = room;
  for (const file of files) {
    const reached = photoLimitReached({ ...room, onEntry, onAccount });
    if (reached) {
      throw Object.assign(new Error(reached.reason), { limit: reached.limit });
    }
    onUploading({ stage: 'preparing' });
    const photo = await shrinkPhoto(file);
    onUploading({ stage: 'uploading', progress: 0 });
    await uploadPhoto({
      entryId,
      photo,
      onProgress: (progress) => onUploading({ stage: 'uploading', progress }),
    });
    onEntry += 1;
    onAccount += 1;
  }
};
