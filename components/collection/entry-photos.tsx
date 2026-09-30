'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconPhotoPlus,
  IconTrash,
} from '@tabler/icons-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { photoPath } from '@/components/collection/photo-urls';
import type { PhotoUploading } from '@/components/collection/upload-photos';
import { useEntryPhotos } from '@/components/collection/use-entry-photos';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErrorMessage } from '@/components/use-error-message';
import type { CollectionPhoto } from '@/lib/db/collection-photos';

export const acceptedPhotos = 'image/*';

export const thumbEdge = 400;

const percent = (fraction: number) => Math.round(fraction * 100);

export const failureDetails = (failure: unknown) =>
  failure instanceof Error &&
  'limit' in failure &&
  typeof failure.limit === 'number'
    ? { limit: failure.limit }
    : {};

function PhotoViewer({
  name,
  photos,
  viewing,
  onClose,
  onMove,
  onDelete,
}: {
  name: string;
  photos: readonly CollectionPhoto[];
  viewing: string | null;
  onClose: () => void;
  onMove: (id: string, offset: -1 | 1) => void;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const t = useTranslations('collection');
  const [confirming, setConfirming] = useState(false);
  const index = photos.findIndex(({ id }) => id === viewing);
  const photo = photos[index];
  const place = { position: index + 1, count: photos.length };
  return (
    <Dialog
      open={photo !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          setConfirming(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        {photo && (
          <>
            <DialogHeader>
              <DialogTitle>{t('photoTitle', place)}</DialogTitle>
            </DialogHeader>
            <Image
              unoptimized
              src={photoPath(photo.id, 'display')}
              width={photo.width}
              height={photo.height}
              alt={t('photoAlt', { name, ...place })}
              className="h-auto max-h-[70dvh] w-full rounded-lg bg-muted object-contain"
            />
            {confirming ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <p className="text-sm sm:mr-auto">{t('deletePhotoWarning')}</p>
                <Button
                  variant="outline"
                  size="touch"
                  onClick={() => setConfirming(false)}
                >
                  {t('keepPhoto')}
                </Button>
                <Button
                  variant="destructive"
                  size="touch"
                  onClick={async () => {
                    setConfirming(false);
                    onClose();
                    await onDelete(photo.id);
                  }}
                >
                  <IconTrash data-icon="inline-start" />
                  {t('deleteForGood')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="destructive"
                  size="touch"
                  className="sm:mr-auto"
                  onClick={() => setConfirming(true)}
                >
                  <IconTrash data-icon="inline-start" />
                  {t('deletePhoto')}
                </Button>
                <Button
                  variant="outline"
                  size="touch"
                  disabled={index === 0}
                  onClick={() => onMove(photo.id, -1)}
                >
                  <IconArrowLeft data-icon="inline-start" />
                  {t('moveEarlier')}
                </Button>
                <Button
                  variant="outline"
                  size="touch"
                  disabled={index === photos.length - 1}
                  onClick={() => onMove(photo.id, 1)}
                >
                  {t('moveLater')}
                  <IconArrowRight data-icon="inline-end" />
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PhotosHeader({
  id,
  count,
  limit,
  disabled,
  onAdd,
}: {
  id: string;
  count: number;
  limit: number | undefined;
  disabled: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations('collection');
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <h3 id={id} className="text-xs font-medium">
            {t('photos')}
          </h3>
          {limit !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t('photoCount', { count, limit })}
            </span>
          )}
        </div>
        {count === 0 && (
          <p className="text-xs text-muted-foreground">{t('noPhotos')}</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="touch"
        aria-label={t('addPhoto')}
        disabled={disabled}
        onClick={onAdd}
      >
        <IconPhotoPlus data-icon="inline-start" />
        {t('addPhotoShort')}
      </Button>
    </div>
  );
}

export function UploadStatus({ uploading }: { uploading: PhotoUploading }) {
  const t = useTranslations('collection');
  const progress = uploading.stage === 'uploading' ? uploading.progress : 0;
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <progress
        aria-label={t('uploadingPhoto')}
        className="h-2 w-full accent-primary"
        max={1}
        {...(uploading.stage === 'uploading' ? { value: progress } : {})}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {uploading.stage === 'preparing'
          ? t('preparingPhoto')
          : t('uploadProgress', { percent: percent(progress) })}
      </span>
    </div>
  );
}

export function EntryPhotos({
  entryId,
  name,
  initialFailure,
}: {
  entryId: string;
  name: string;
  initialFailure?: unknown;
}) {
  const t = useTranslations('collection');
  const describe = useErrorMessage();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const { list, overview, limit, uploading, failure, add, move, remove } =
    useEntryPhotos(entryId, initialFailure);
  const ready = overview.data !== undefined;

  return (
    <section aria-labelledby={`${id}-photos`} className="flex flex-col gap-2">
      <PhotosHeader
        id={`${id}-photos`}
        count={list.length}
        limit={overview.data?.perEntry}
        disabled={!ready || limit !== null || uploading !== null}
        onAdd={() => input.current?.click()}
      />
      {list.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-2">
            {list.map((photo, index) => {
              const place = { position: index + 1, count: list.length };
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    className="block aspect-square w-full overflow-hidden rounded-lg bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={t('viewPhoto', place)}
                    onClick={() => setViewing(photo.id)}
                  >
                    <Image
                      unoptimized
                      src={photoPath(photo.id, 'thumb')}
                      alt={t('photoAlt', { name, ...place })}
                      width={thumbEdge}
                      height={thumbEdge}
                      className="size-full object-cover"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{t('photosHint')}</p>
        </>
      )}
      {uploading && <UploadStatus uploading={uploading} />}
      {failure !== undefined ? (
        <Notice>{describe(failure, failureDetails(failure))}</Notice>
      ) : (
        limit && (
          <Notice severity="warning">
            {describe(new Error(limit.reason), { limit: limit.limit })}
          </Notice>
        )
      )}
      <input
        ref={input}
        type="file"
        accept={acceptedPhotos}
        multiple
        hidden
        aria-label={t('photoFiles')}
        onChange={async (event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          await add(files);
        }}
      />
      <PhotoViewer
        name={name}
        photos={list}
        viewing={viewing}
        onClose={() => setViewing(null)}
        onMove={move}
        onDelete={remove}
      />
    </section>
  );
}
