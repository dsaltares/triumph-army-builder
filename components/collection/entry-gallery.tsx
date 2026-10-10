'use client';

import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { photoPath } from '@/components/collection/photo-urls';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CollectionPhotoCover } from '@/lib/db/collection-photos';
import type { CollectionEntry } from '@/lib/domain/collection/entry';
import { useTRPC } from '@/lib/trpc/client';

export type GalleryViewing = {
  entry: CollectionEntry;
  cover: CollectionPhotoCover;
} | null;

function Gallery({ entry, cover }: NonNullable<GalleryViewing>) {
  const t = useTranslations('collection');
  const trpc = useTRPC();
  const list = useQuery(
    trpc.collection.photos.list.queryOptions({ entryId: entry.id }),
  );
  const photos: readonly CollectionPhotoCover[] = list.data?.length
    ? list.data
    : [cover];
  const [wanted, setWanted] = useState(0);
  const index = Math.min(wanted, photos.length - 1);
  const photo = photos[index] ?? cover;
  const place = { position: index + 1, count: photos.length };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry.name}</DialogTitle>
        <DialogDescription>{t('photoTitle', place)}</DialogDescription>
      </DialogHeader>
      <Image
        unoptimized
        src={photoPath(photo.id, 'display')}
        width={photo.width}
        height={photo.height}
        alt={t('photoAlt', { name: entry.name, ...place })}
        className="h-auto max-h-[70dvh] w-full rounded-lg bg-muted object-contain"
      />
      {photos.length > 1 && (
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            size="touch"
            disabled={index === 0}
            onClick={() => setWanted(index - 1)}
          >
            <IconArrowLeft data-icon="inline-start" />
            {t('previousPhoto')}
          </Button>
          <Button
            variant="outline"
            size="touch"
            disabled={index === photos.length - 1}
            onClick={() => setWanted(index + 1)}
          >
            {t('nextPhoto')}
            <IconArrowRight data-icon="inline-end" />
          </Button>
        </div>
      )}
    </>
  );
}

export function EntryGallery({
  viewing,
  onClose,
}: {
  viewing: GalleryViewing;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={viewing !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        {viewing && <Gallery key={viewing.entry.id} {...viewing} />}
      </DialogContent>
    </Dialog>
  );
}
