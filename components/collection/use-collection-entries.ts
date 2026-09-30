'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useErrorMessage } from '@/components/use-error-message';
import type { CollectionEntry } from '@/lib/domain/collection/entry';
import { useTRPC, useTRPCClient } from '@/lib/trpc/client';

const undoWindowMs = 8000;

const useSettleCollection = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: trpc.collection.pathKey() });
};

export const useCreateEntry = () => {
  const trpc = useTRPC();
  const settle = useSettleCollection();
  return useMutation(
    trpc.collection.create.mutationOptions({ onSettled: settle }),
  );
};

export const useUpdateEntry = () => {
  const trpc = useTRPC();
  const settle = useSettleCollection();
  return useMutation(
    trpc.collection.update.mutationOptions({ onSettled: settle }),
  );
};

const withoutId = (ids: ReadonlySet<string>, id: string) => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

export const useCollectionEntries = () => {
  const t = useTranslations('collection');
  const describe = useErrorMessage();
  const trpc = useTRPC();
  const client = useTRPCClient();
  const settle = useSettleCollection();
  const [deleting, setDeleting] = useState<ReadonlySet<string>>(new Set());
  const hideDeleting = useCallback(
    (entries: CollectionEntry[]) =>
      entries.filter(({ id }) => !deleting.has(id)),
    [deleting],
  );
  const entries = useQuery({
    ...trpc.collection.list.queryOptions(),
    select: hideDeleting,
  });

  const show = (id: string) => setDeleting((ids) => withoutId(ids, id));

  const remove = ({ id, name }: CollectionEntry) => {
    setDeleting((ids) => new Set(ids).add(id));
    let decided = false;
    const once = (decide: () => void) => () => {
      if (!decided) {
        decided = true;
        decide();
      }
    };
    const commit = once(() =>
      client.collection.delete
        .mutate({ id })
        .catch((error: unknown) => toast.error(describe(error)))
        .then(settle)
        .finally(() => show(id)),
    );
    toast(t('entryDeleted', { name }), {
      duration: undoWindowMs,
      action: { label: t('undo'), onClick: once(() => show(id)) },
      onAutoClose: commit,
      onDismiss: commit,
    });
  };

  return { entries, remove };
};
