'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useCreateArmy } from '@/components/army/use-saved-armies';
import { useFetchCurrentDataVersion } from '@/components/use-current-data-version';
import { useErrorMessage } from '@/components/use-error-message';
import { startBuilding } from '@/lib/domain/army/builder';
import { defaultListName } from '@/lib/domain/army/saved-army';
import type { ArmySelection } from '@/lib/domain/army/selection';
import { savedListUrl } from '@/lib/navigation';

export type StartableArmy = {
  id: string;
  name: string;
  startDate: number;
  endDate: number;
};

export const useOpenNewList = () => {
  const router = useRouter();
  const create = useCreateArmy();
  const describe = useErrorMessage();

  const open = useCallback(
    async (armyName: string, selection: ArmySelection) => {
      try {
        const created = await create.mutateAsync({
          name: defaultListName(armyName, new Date()),
          selection,
        });
        router.push(savedListUrl(created));
      } catch (thrown: unknown) {
        toast.error(describe(thrown));
      }
    },
    [create, router, describe],
  );

  return { open, opening: create.isPending };
};

export const useStartList = () => {
  const { open, opening } = useOpenNewList();
  const fetchDataVersion = useFetchCurrentDataVersion();
  const describe = useErrorMessage();

  const start = useCallback(
    async ({ id, name, startDate, endDate }: StartableArmy) => {
      const dataVersion = await fetchDataVersion().catch((thrown: unknown) => {
        toast.error(describe(thrown));
        return null;
      });
      if (dataVersion === null) {
        return;
      }
      await open(
        name,
        startBuilding({ id, dateRange: { startDate, endDate } }, dataVersion),
      );
    },
    [open, fetchDataVersion, describe],
  );

  return { start, starting: opening };
};
