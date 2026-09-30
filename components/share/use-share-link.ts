'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { startAnonymousSession, useSession } from '@/lib/auth/client';
import type { ArmySelection } from '@/lib/domain/army/selection';
import { describeError } from '@/lib/errors';
import { sharedListUrl } from '@/lib/navigation';
import { useTRPC, useTRPCClient } from '@/lib/trpc/client';

export type ShareInput = {
  name: string;
  selection: ArmySelection;
};

const shareLinkFor = (id: string) =>
  `${globalThis.location?.origin ?? ''}${sharedListUrl(id)}`;

const useCreateShareLink = () => {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const { data: session } = useSession();

  return useMutation({
    ...trpc.share.create.mutationOptions(),
    mutationFn: async (input: ShareInput) => {
      if (!session) {
        await startAnonymousSession();
      }
      return client.share.create.mutate(input);
    },
  });
};

export const useShareId = () => {
  const { mutateAsync } = useCreateShareLink();

  return useCallback(
    async (list: ShareInput) => {
      try {
        return (await mutateAsync(list)).id;
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );
};

export const useShareLink = () => {
  const { mutate, reset, data, error, isPending } = useCreateShareLink();
  const [open, setOpen] = useState(false);

  const share = useCallback(
    (list: ShareInput) => {
      setOpen(true);
      mutate(list);
    },
    [mutate],
  );

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        reset();
      }
    },
    [reset],
  );

  return {
    share,
    dialog: {
      open,
      pending: isPending,
      error: error ? describeError(error) : null,
      url: data ? shareLinkFor(data.id) : null,
      onOpenChange,
    },
  };
};
