'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export function BuilderSkeleton() {
  const t = useTranslations('builder');
  return (
    <div
      className="flex flex-col gap-section"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{t('loadingArmyList')}</span>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-1.5 w-full" />
      </div>
      <Skeleton className="h-44" aria-hidden="true" />
      <Skeleton className="h-72" aria-hidden="true" />
      <Skeleton className="h-48" aria-hidden="true" />
      <Skeleton className="h-40" aria-hidden="true" />
      <Skeleton className="h-64" aria-hidden="true" />
      <Skeleton className="h-56" aria-hidden="true" />
      <Skeleton className="h-32" aria-hidden="true" />
    </div>
  );
}
