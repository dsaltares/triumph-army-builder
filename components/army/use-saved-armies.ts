'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import { startAnonymousSession, useSession } from '@/lib/auth/client';
import {
  copyName,
  type SavedArmy,
  withArmyRemoved,
  withArmyUpserted,
} from '@/lib/domain/army/saved-army';
import type { ArmySelection } from '@/lib/domain/army/selection';
import { recordListSaved } from '@/lib/install';
import { routes } from '@/lib/navigation';
import { useTRPC, useTRPCClient } from '@/lib/trpc/client';

type ArmyListChange = (armies: SavedArmy[]) => SavedArmy[];

type Rollback = { previous: SavedArmy[] | undefined };

const pending = ({
  id,
  name,
  selection,
  at,
}: {
  id: string;
  name: string;
  selection: ArmySelection;
  at: string;
}): SavedArmy => ({
  id,
  name,
  game: 'triumph',
  armyListId: selection.army,
  dataVersion: selection.dataVersion,
  selection,
  createdAt: at,
  updatedAt: at,
});

const useArmyListCache = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.army.list.queryKey();
  const armyKey = trpc.army.pathKey();

  const apply = async (change: ArmyListChange): Promise<Rollback> => {
    await queryClient.cancelQueries({ queryKey: armyKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, change(previous ?? []));
    return { previous };
  };

  const rollback = ({ previous }: Rollback) => {
    queryClient.setQueryData(queryKey, previous);
  };

  const settle = () => queryClient.invalidateQueries({ queryKey: armyKey });

  const remember = (army: SavedArmy) => {
    queryClient.setQueryData(trpc.army.byId.queryKey({ id: army.id }), army);
  };

  return { apply, rollback, settle, remember };
};

export const useSavedArmies = () => {
  const trpc = useTRPC();
  return useQuery(trpc.army.list.queryOptions());
};

export const useSavedArmy = (id: string | null) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.army.byId.queryOptions({ id: id ?? '' }),
    enabled: id !== null,
  });
};

export const useCreateArmy = () => {
  const trpc = useTRPC();
  const cache = useArmyListCache();
  const client = useTRPCClient();
  const router = useRouter();
  const t = useTranslations('armies');
  const auth = useTranslations('auth');
  const { data: session } = useSession();
  const options = trpc.army.create.mutationOptions({
    onMutate: ({ name, selection }) =>
      cache.apply((armies) =>
        withArmyUpserted(
          armies,
          pending({
            id: uuid(),
            name,
            selection,
            at: new Date().toISOString(),
          }),
        ),
      ),
    onError: (_error, _input, context) => context && cache.rollback(context),
    onSettled: cache.settle,
  });

  return useMutation({
    ...options,
    mutationFn: async (input) => {
      if (!session) {
        await startAnonymousSession();
      }
      return client.army.create.mutate(input);
    },
    onSuccess: (created) => {
      cache.remember(created);
      recordListSaved();
      if (session) {
        return;
      }
      toast.info(t('savedInBrowser'), {
        description: t('savedInBrowserDescription'),
        action: {
          label: auth('signIn'),
          onClick: () => router.push(routes.signIn),
        },
      });
    },
  });
};

export const useUpdateArmy = () => {
  const trpc = useTRPC();
  const cache = useArmyListCache();
  return useMutation(
    trpc.army.update.mutationOptions({
      onMutate: ({ id, name, selection }) =>
        cache.apply((armies) => {
          const army = armies.find((candidate) => candidate.id === id);
          return army
            ? withArmyUpserted(armies, {
                ...army,
                ...(name === undefined ? {} : { name }),
                ...(selection === undefined
                  ? {}
                  : {
                      selection,
                      armyListId: selection.army,
                      dataVersion: selection.dataVersion,
                    }),
                updatedAt: new Date().toISOString(),
              })
            : armies;
        }),
      onSuccess: (army) => cache.remember(army),
      onError: (_error, _input, context) => context && cache.rollback(context),
      onSettled: cache.settle,
    }),
  );
};

export const useDuplicateArmy = () => {
  const trpc = useTRPC();
  const cache = useArmyListCache();
  return useMutation(
    trpc.army.duplicate.mutationOptions({
      onMutate: ({ id }) =>
        cache.apply((armies) => {
          const army = armies.find((candidate) => candidate.id === id);
          return army
            ? withArmyUpserted(
                armies,
                pending({
                  id: uuid(),
                  name: copyName(army.name),
                  selection: army.selection,
                  at: new Date().toISOString(),
                }),
              )
            : armies;
        }),
      onError: (_error, _input, context) => context && cache.rollback(context),
      onSettled: cache.settle,
    }),
  );
};

export const useDeleteArmy = () => {
  const trpc = useTRPC();
  const cache = useArmyListCache();
  return useMutation(
    trpc.army.delete.mutationOptions({
      onMutate: ({ id }) =>
        cache.apply((armies) => withArmyRemoved(armies, id)),
      onError: (_error, _input, context) => context && cache.rollback(context),
      onSettled: cache.settle,
    }),
  );
};

export const useUndoClaim = () => {
  const trpc = useTRPC();
  const cache = useArmyListCache();
  return useMutation(
    trpc.army.undoClaim.mutationOptions({
      onMutate: ({ ids }) =>
        cache.apply((armies) =>
          armies.filter((army) => !ids.includes(army.id)),
        ),
      onError: (_error, _input, context) => context && cache.rollback(context),
      onSettled: cache.settle,
    }),
  );
};
