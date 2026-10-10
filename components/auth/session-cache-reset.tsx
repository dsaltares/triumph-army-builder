'use client';

import { matchQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth/client';
import { isAnonymousSession } from '@/lib/auth/session';
import { useTRPC } from '@/lib/trpc/client';

type Identity = string | null | undefined;

const mintedForThisBrowser = (was: Identity, anonymous: boolean) =>
  was === null && anonymous;

export function SessionCacheReset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data, isPending } = useSession();
  const identity: Identity = isPending ? undefined : (data?.user.id ?? null);
  const anonymous = isAnonymousSession(data);
  const previous = useRef<Identity>(identity);

  useEffect(() => {
    const was = previous.current;
    previous.current = identity;
    if (
      was === undefined ||
      identity === undefined ||
      was === identity ||
      mintedForThisBrowser(was, anonymous)
    ) {
      return;
    }
    const referenceKey = trpc.reference.pathKey();
    queryClient.resetQueries({
      predicate: (query) => !matchQuery({ queryKey: referenceKey }, query),
    });
  }, [identity, anonymous, queryClient, trpc]);

  return null;
}
