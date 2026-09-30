'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

const rows = [0, 1, 2, 3, 4, 5];

export function ArmyRowsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {rows.map((row) => (
        <Skeleton key={row} className="h-20" />
      ))}
    </div>
  );
}

export function ArmyIndexSkeleton() {
  const t = useTranslations('armies');
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loadingArmyLists')}</span>
      <div className="flex items-center gap-2" aria-hidden="true">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-24" />
      </div>
      <ArmyRowsSkeleton />
    </div>
  );
}
