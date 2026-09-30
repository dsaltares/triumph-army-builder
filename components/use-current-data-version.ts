'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTRPC } from '@/lib/trpc/client';

export const useCurrentDataVersion = () =>
  useQuery(useTRPC().reference.current.queryOptions());

export const useFetchCurrentDataVersion = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.fetchQuery(trpc.reference.current.queryOptions()),
    [queryClient, trpc],
  );
};
