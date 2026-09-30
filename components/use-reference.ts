'use client';

import { useLocale } from 'next-intl';
import { useCurrentDataVersion } from '@/components/use-current-data-version';

export const referenceStaleTime = Number.POSITIVE_INFINITY;

export const useReference = () => {
  const locale = useLocale();
  const current = useCurrentDataVersion();
  return {
    reference:
      current.data === undefined ? null : { locale, dataVersion: current.data },
    error: current.error,
  };
};
