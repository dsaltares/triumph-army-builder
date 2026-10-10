'use client';

import { IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { blankEntry, EntryForm } from '@/components/collection/entry-form';
import { EntryPhotos } from '@/components/collection/entry-photos';
import {
  type PendingPhoto,
  PendingPhotos,
} from '@/components/collection/pending-photos';
import {
  type PhotoUploading,
  uploadPhotos,
} from '@/components/collection/upload-photos';
import {
  useCreateEntry,
  useUpdateEntry,
} from '@/components/collection/use-collection-entries';
import type { NewEntry } from '@/components/collection/use-new-entry-param';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CollectionEntry } from '@/lib/domain/collection/entry';
import type { CollectionEntryFormInput } from '@/lib/domain/collection/entry-schema';
import { useTRPC } from '@/lib/trpc/client';

export type EntryEditing =
  | { entry: CollectionEntry; failure?: unknown }
  | ({ entry: null } & NewEntry)
  | null;

const formValues = (entry: CollectionEntry): CollectionEntryFormInput => {
  const { name, count, tags, games, status, notes } = entry;
  return {
    ...(entry.kind === 'hero'
      ? { kind: 'hero', troopType: null }
      : { troopType: entry.troopType }),
    name,
    count,
    tags,
    games,
    status,
    notes,
  };
};

const newEntryValues = (draft: NewEntry): CollectionEntryFormInput =>
  draft.kind === 'hero'
    ? { ...blankEntry, kind: 'hero' }
    : { ...blankEntry, troopType: draft.troopType };

function Cancel() {
  const t = useTranslations('collection');
  return (
    <DialogClose
      render={<Button type="button" variant="outline" size="touch" />}
    >
      {t('cancel')}
    </DialogClose>
  );
}

function AddEntry({
  draft,
  onDone,
  onUploadFailed,
}: {
  draft: NewEntry;
  onDone: () => void;
  onUploadFailed: (entry: CollectionEntry, failure: unknown) => void;
}) {
  const t = useTranslations('collection');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const create = useCreateEntry();
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState<PhotoUploading | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const upload = async (entry: CollectionEntry) => {
    const overview = await queryClient.fetchQuery(
      trpc.collection.photos.overview.queryOptions(),
    );
    try {
      await uploadPhotos({
        entryId: entry.id,
        files: photos.map(({ file }) => file),
        room: { ...overview, onEntry: 0 },
        onUploading: setUploading,
      });
    } finally {
      setUploading(null);
      await queryClient.invalidateQueries({
        queryKey: trpc.collection.pathKey(),
      });
    }
  };

  return (
    <EntryForm
      values={newEntryValues(draft)}
      photos={
        <PendingPhotos
          photos={photos}
          uploading={uploading}
          disabled={submitting}
          onChange={setPhotos}
        />
      }
      submit={t('addToCollection')}
      working={t('adding')}
      onSubmit={async (values) => {
        setSubmitting(true);
        try {
          const entry = await create.mutateAsync(values);
          if (photos.length > 0) {
            try {
              await upload(entry);
            } catch (failure: unknown) {
              onUploadFailed(entry, failure);
              return;
            }
          }
          onDone();
        } finally {
          setSubmitting(false);
        }
      }}
      actions={<Cancel />}
    />
  );
}

function EditEntry({
  entry,
  failure,
  onDone,
  onDelete,
}: {
  entry: CollectionEntry;
  failure: unknown;
  onDone: () => void;
  onDelete: (entry: CollectionEntry) => void;
}) {
  const t = useTranslations('collection');
  const update = useUpdateEntry();
  return (
    <EntryForm
      values={formValues(entry)}
      photos={
        <EntryPhotos
          entryId={entry.id}
          name={entry.name}
          initialFailure={failure}
        />
      }
      submit={t('saveEntry')}
      working={t('saving')}
      onSubmit={async (changes) => {
        await update.mutateAsync({ id: entry.id, ...changes });
        onDone();
      }}
      actions={
        <>
          <Button
            type="button"
            variant="destructive"
            size="touch"
            className="sm:mr-auto"
            onClick={() => {
              onDone();
              onDelete(entry);
            }}
          >
            <IconTrash data-icon="inline-start" />
            {t('deleteEntry')}
          </Button>
          <Cancel />
        </>
      }
    />
  );
}

export function EntryDialog({
  editing,
  onClose,
  onEdit,
  onDelete,
}: {
  editing: EntryEditing;
  onClose: () => void;
  onEdit: (editing: NonNullable<EntryEditing>) => void;
  onDelete: (entry: CollectionEntry) => void;
}) {
  const t = useTranslations('collection');
  const entry = editing?.entry ?? null;
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {entry ? t('editEntryTitle', { name: entry.name }) : t('addTitle')}
          </DialogTitle>
        </DialogHeader>
        {editing &&
          (editing.entry ? (
            <EditEntry
              key={editing.entry.id}
              entry={editing.entry}
              failure={'failure' in editing ? editing.failure : undefined}
              onDone={onClose}
              onDelete={onDelete}
            />
          ) : (
            <AddEntry
              draft={editing}
              onDone={onClose}
              onUploadFailed={(created, failure) =>
                onEdit({ entry: created, failure })
              }
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
