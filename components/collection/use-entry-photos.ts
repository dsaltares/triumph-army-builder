'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  type PhotoUploading,
  uploadPhotos,
} from '@/components/collection/upload-photos';
import type { CollectionPhoto } from '@/lib/db/collection-photos';
import {
  movedPhoto,
  type PhotoLimit,
  photoLimitReached,
} from '@/lib/domain/collection/photos';
import { useTRPC } from '@/lib/trpc/client';

export const useEntryPhotos = (entryId: string, initialFailure?: unknown) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.collection.photos.list.queryKey({ entryId });
  const photos = useQuery(
    trpc.collection.photos.list.queryOptions({ entryId }),
  );
  const overview = useQuery(trpc.collection.photos.overview.queryOptions());
  const [uploading, setUploading] = useState<PhotoUploading | null>(null);
  const [failure, setFailure] = useState<unknown>(initialFailure);

  const settle = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.collection.photos.pathKey(),
    });

  const list = photos.data ?? [];
  const limit: PhotoLimit | null =
    photos.data && overview.data
      ? photoLimitReached({
          onEntry: photos.data.length,
          onAccount: overview.data.onAccount,
          perEntry: overview.data.perEntry,
          perAccount: overview.data.perAccount,
        })
      : null;

  const add = async (files: readonly File[]) => {
    if (!photos.data || !overview.data) {
      return;
    }
    setFailure(undefined);
    try {
      await uploadPhotos({
        entryId,
        files,
        room: { ...overview.data, onEntry: photos.data.length },
        onUploading: setUploading,
      });
    } catch (error: unknown) {
      setFailure(error);
    } finally {
      setUploading(null);
      await settle();
    }
  };

  const reorder = useMutation(
    trpc.collection.photos.reorder.mutationOptions({
      onMutate: async ({ ids }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        queryClient.setQueryData<CollectionPhoto[]>(listKey, (current) =>
          ids.flatMap(
            (id) => current?.filter((photo) => photo.id === id) ?? [],
          ),
        );
      },
      onError: setFailure,
      onSettled: settle,
    }),
  );

  const move = (id: string, offset: -1 | 1) => {
    setFailure(undefined);
    reorder.mutate({
      entryId,
      ids: movedPhoto(
        list.map((photo) => photo.id),
        id,
        offset,
      ),
    });
  };

  const remove = useMutation(
    trpc.collection.photos.delete.mutationOptions({
      onMutate: () => setFailure(undefined),
      onError: setFailure,
      onSettled: settle,
    }),
  );

  return {
    photos,
    overview,
    list,
    limit,
    uploading,
    failure,
    add,
    move,
    remove: (id: string) => remove.mutateAsync({ id }),
  };
};
