'use client';

import { useLocale } from 'next-intl';
import type { PointsMeter, PointsStatus } from '@/lib/domain/army/builder';
import { formatPoints } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locales';
import { wordsFor } from '@/lib/i18n/translator';
import { cn } from '@/lib/utils';

const barColours: Record<PointsStatus, string> = {
  under: 'bg-warning',
  exact: 'bg-success',
  over: 'bg-destructive',
};

const describe = ({ total, cap, status }: PointsMeter, locale: Locale) => {
  const w = wordsFor(locale, 'armies');
  const spent = w('pointsOfCap', { points: formatPoints(total), cap });
  switch (status) {
    case 'under':
      return w('pointsStillToFill', { spent });
    case 'exact':
      return w('pointsFullArmy', { spent });
    case 'over':
      return w('pointsOverCap', { spent });
  }
};

export function SavedArmyPoints({ meter }: { meter: PointsMeter }) {
  const locale = useLocale();
  const { total, cap, status, filled } = meter;
  return (
    <span className="flex flex-col gap-1">
      <span className="text-xs tabular-nums">
        {`${formatPoints(total)} / ${cap}`}
      </span>
      <span
        className="block h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={Math.min(total, cap)}
        aria-valuetext={describe(meter, locale)}
      >
        <span
          className={cn('block h-full rounded-full', barColours[status])}
          style={{ width: `${filled * 100}%` }}
        />
      </span>
    </span>
  );
}
