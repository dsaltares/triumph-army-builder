import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { findingAnchor } from '@/components/builder/finding-anchor';
import type { PointsMeter, PointsStatus } from '@/lib/domain/army/builder';
import { formatPoints } from '@/lib/format';
import { cn } from '@/lib/utils';

const barColours: Record<PointsStatus, string> = {
  under: 'bg-primary',
  exact: 'bg-success',
  over: 'bg-destructive',
};

const remainingColours: Record<PointsStatus, string> = {
  under: 'text-muted-foreground',
  exact: 'text-success',
  over: 'text-destructive',
};

type BuilderWords = ReturnType<typeof useTranslations<'builder'>>;

const describeRemaining = (
  { remaining, status }: PointsMeter,
  t: BuilderWords,
) => {
  switch (status) {
    case 'under':
      return t('pointsLeft', { points: formatPoints(remaining) });
    case 'exact':
      return t('fullArmy');
    case 'over':
      return t('pointsOver', { points: formatPoints(-remaining) });
  }
};

const describeSubtotals = (
  { standPoints, allyStandPoints, battleCardPoints }: PointsMeter,
  t: BuilderWords,
) => {
  const subtotals = t('subtotals', {
    stands: formatPoints(standPoints),
    cards: formatPoints(battleCardPoints),
  });
  return allyStandPoints > 0
    ? t('subtotalsAllied', {
        subtotals,
        allied: formatPoints(allyStandPoints),
      })
    : subtotals;
};

export function PointsMeterBar({
  meter,
  trailing,
}: {
  meter: PointsMeter;
  trailing?: ReactNode;
}) {
  const t = useTranslations('builder');
  const { total, cap, status, filled } = meter;
  const remaining = describeRemaining(meter, t);
  return (
    <div
      id={findingAnchor({ kind: 'army' })}
      className="sticky top-14 z-30 -mx-gutter flex flex-col gap-2 border-b bg-background px-gutter py-2.5"
    >
      <div className="flex items-baseline gap-2" role="status">
        <p className="flex items-baseline gap-1">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {formatPoints(total)}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            / {cap}
          </span>
          <span className="text-xs text-muted-foreground">points</span>
        </p>
        <span
          className={cn(
            'ml-auto text-xs font-medium tabular-nums',
            remainingColours[status],
          )}
        >
          {remaining}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={t('pointsSpent')}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={Math.min(total, cap)}
        aria-valuetext={`${formatPoints(total)} of ${cap} points, ${remaining}`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            barColours[status],
          )}
          style={{ width: `${filled * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          {describeSubtotals(meter, t)}
        </p>
        {trailing && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {trailing}
          </div>
        )}
      </div>
    </div>
  );
}
