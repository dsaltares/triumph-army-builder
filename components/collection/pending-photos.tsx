'use client';

import { IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import {
  acceptedPhotos,
  PhotosHeader,
  thumbEdge,
  UploadStatus,
} from '@/components/collection/entry-photos';
import type { PhotoUploading } from '@/components/collection/upload-photos';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/components/use-error-message';
import { photoLimitReached, photoSpace } from '@/lib/domain/collection/photos';
import { useTRPC } from '@/lib/trpc/client';

const useObjectUrl = (file: File) => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file]);
  return url;
};

function PendingThumb({
  file,
  place,
  disabled,
  onRemove,
}: {
  file: File;
  place: { position: number; count: number };
  disabled: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations('collection');
  const url = useObjectUrl(file);
  return (
    <li className="relative aspect-square overflow-hidden rounded-lg bg-muted">
      {url && (
        <Image
          unoptimized
          src={url}
          alt={t('pendingPhotoAlt', place)}
          width={thumbEdge}
          height={thumbEdge}
          className="size-full object-cover"
        />
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon-touch"
        className="absolute top-1 right-1"
        aria-label={t('removePendingPhoto', place)}
        disabled={disabled}
        onClick={onRemove}
      >
        <IconX />
      </Button>
    </li>
  );
}

export type PendingPhoto = { id: string; file: File };

export function PendingPhotos({
  photos,
  uploading,
  disabled,
  onChange,
}: {
  photos: readonly PendingPhoto[];
  uploading: PhotoUploading | null;
  disabled: boolean;
  onChange: (photos: PendingPhoto[]) => void;
}) {
  const t = useTranslations('collection');
  const describe = useErrorMessage();
  const trpc = useTRPC();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const picks = useRef(0);
  const overview = useQuery(trpc.collection.photos.overview.queryOptions());
  const room = overview.data && {
    ...overview.data,
    onEntry: photos.length,
    onAccount: overview.data.onAccount + photos.length,
  };
  const limit = room ? photoLimitReached(room) : null;
  const space = room ? photoSpace(room) : 0;

  return (
    <section aria-labelledby={`${id}-photos`} className="flex flex-col gap-2">
      <PhotosHeader
        id={`${id}-photos`}
        count={photos.length}
        limit={overview.data?.perEntry}
        disabled={disabled || !overview.data || limit !== null}
        onAdd={() => input.current?.click()}
      />
      {photos.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-2">
            {photos.map(({ id: key, file }, index) => (
              <PendingThumb
                key={key}
                file={file}
                place={{ position: index + 1, count: photos.length }}
                disabled={disabled}
                onRemove={() =>
                  onChange(photos.filter((photo) => photo.id !== key))
                }
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {t('pendingPhotosHint')}
          </p>
        </>
      )}
      {uploading && <UploadStatus uploading={uploading} />}
      {limit && (
        <Notice severity="warning">
          {describe(new Error(limit.reason), { limit: limit.limit })}
        </Notice>
      )}
      <input
        ref={input}
        type="file"
        accept={acceptedPhotos}
        multiple
        hidden
        aria-label={t('photoFiles')}
        onChange={(event) => {
          const picked = [...(event.target.files ?? [])];
          event.target.value = '';
          onChange([
            ...photos,
            ...picked.slice(0, space).map((file) => {
              picks.current += 1;
              return { id: `${id}-${picks.current}`, file };
            }),
          ]);
        }}
      />
    </section>
  );
}
