'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/client';
import { isSignedIn } from '@/lib/auth/session';
import { navItemsFor } from '@/lib/navigation';
import { useTRPC } from '@/lib/trpc/client';

const useIsAdmin = () => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const userId = isSignedIn(session) ? session.user.id : null;
  const { data: viewer } = useQuery(
    trpc.admin.viewer.queryOptions(undefined, { enabled: userId !== null }),
  );
  return userId !== null && viewer?.userId === userId && viewer.isAdmin;
};

export const useNavItems = () => navItemsFor(useIsAdmin());
