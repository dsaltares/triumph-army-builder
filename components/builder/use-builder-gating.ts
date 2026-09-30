'use client';

import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import type { ArmyList } from '@/lib/domain/army/army-list';
import type { Gating } from '@/lib/domain/army/availability';
import { startingYear } from '@/lib/domain/army/builder';

export const builderGatingParsers = {
  year: parseAsInteger,
  variant: parseAsString,
};

export const useBuilderGating = (
  armyList: ArmyList,
  saved: Gating | null = null,
) => {
  const [params, setParams] = useQueryStates(builderGatingParsers);
  const gating = useMemo<Gating>(
    () => ({
      year: params.year ?? saved?.year ?? startingYear(armyList),
      variant:
        params.variant === ''
          ? null
          : (params.variant ?? saved?.variant ?? null),
    }),
    [params.year, params.variant, armyList, saved?.year, saved?.variant],
  );
  return {
    gating,
    setYear: (year: number) => {
      void setParams({ year });
    },
    setVariant: (variant: string | null) => {
      void setParams({ variant });
    },
  };
};
