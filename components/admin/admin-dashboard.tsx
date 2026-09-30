'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useId } from 'react';
import type { ChartPoint } from '@/components/admin/usage-chart';
import { UsageInterest } from '@/components/admin/usage-interest';
import { UsagePlaces } from '@/components/admin/usage-places';
import { UsageTiles } from '@/components/admin/usage-tiles';
import { useDashboardParams } from '@/components/admin/use-dashboard-params';
import { ChipGroup } from '@/components/chip-group';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { Section } from '@/components/layout/section';
import { LoadFailure } from '@/components/load-failure';
import { Button } from '@/components/ui/button';
import type { ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorMessage } from '@/components/use-error-message';
import {
  type SocialProviderId,
  socialProviderNames,
} from '@/lib/auth/providers';
import {
  bucketFor,
  isQuiet,
  pointsByMethod,
  seriesTotal,
} from '@/lib/domain/usage/dashboard';
import {
  type SeriesPoint,
  type StatsAudience,
  type StatsBucket,
  type StatsRange,
  statsAudiences,
  statsRanges,
} from '@/lib/domain/usage/stats-window';
import { formatCount, formatDate } from '@/lib/format';
import { useTRPC } from '@/lib/trpc/client';

const UsageChart = lazy(async () => ({
  default: (await import('@/components/admin/usage-chart')).UsageChart,
}));

const widestRange: StatsRange = '12m';

const widestAudience: StatsAudience = 'all';

const rangeKeys = {
  '7d': 'range7d',
  '30d': 'range30d',
  '90d': 'range90d',
  '12m': 'range12m',
} as const satisfies Record<StatsRange, string>;

const audienceKeys = {
  all: 'audienceAll',
  account: 'audienceAccount',
  anonymous: 'audienceAnonymous',
} as const satisfies Record<StatsAudience, string>;

const accountColor = { light: 'var(--chart-5)', dark: 'var(--chart-1)' };

const anonymousColor = { light: 'var(--chart-3)', dark: 'var(--chart-3)' };

const neutralColor = {
  light: 'var(--muted-foreground)',
  dark: 'var(--muted-foreground)',
};

type SignInMethod = 'password' | SocialProviderId;

const methodColors = {
  password: accountColor,
  google: anonymousColor,
  discord: neutralColor,
} satisfies Record<SignInMethod, typeof accountColor>;

const placeholderTiles = ['users', 'lists', 'shares', 'entries'] as const;

const dayBeforeMs = 24 * 60 * 60 * 1000;

const lastDayOf = (to: string) =>
  new Date(new Date(to).getTime() - dayBeforeMs).toISOString();

function Loading() {
  const t = useTranslations('admin');
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <div className="grid grid-cols-1 gap-3 min-[22rem]:grid-cols-2 lg:grid-cols-4">
        {placeholderTiles.map((tile) => (
          <Skeleton key={tile} className="h-24" />
        ))}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  total,
  points,
  config,
  bucket,
}: {
  title: string;
  total: number;
  points: readonly ChartPoint[];
  config: ChartConfig;
  bucket: StatsBucket;
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const titleId = useId();
  const formatBucket = (day: string) =>
    bucket === 'week'
      ? t('weekOf', { date: formatDate(day, locale) })
      : formatDate(day, locale);
  return (
    <figure
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-card p-4 ring-1 ring-foreground/10"
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span id={titleId} className="text-sm font-medium">
          {title}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('chartTotal', { count: formatCount(total, locale) })}
        </span>
      </figcaption>
      <Suspense fallback={<Skeleton className="h-44" />}>
        <UsageChart
          points={points}
          config={config}
          formatBucket={formatBucket}
        />
      </Suspense>
    </figure>
  );
}

function Controls({
  range,
  audience,
  onRange,
  onAudience,
}: {
  range: StatsRange;
  audience: StatsAudience;
  onRange: (range: StatsRange) => void;
  onAudience: (audience: StatsAudience) => void;
}) {
  const t = useTranslations('admin');
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      <ChipGroup
        label={t('rangeLabel')}
        options={statsRanges}
        selected={[range]}
        onToggle={onRange}
        labelFor={(option) => t(rangeKeys[option])}
      />
      <ChipGroup
        label={t('audienceLabel')}
        options={statsAudiences}
        selected={[audience]}
        onToggle={onAudience}
        labelFor={(option) => t(audienceKeys[option])}
      />
    </div>
  );
}

export function AdminDashboard() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const trpc = useTRPC();
  const [{ range, audience }, setParams] = useDashboardParams();
  const bucket = bucketFor(range);
  const stats = useQuery({
    ...trpc.admin.stats.queryOptions({ range, bucket, audience }),
    placeholderData: keepPreviousData,
  });

  const narrowed = range !== widestRange || audience !== widestAudience;
  const widen = narrowed ? (
    <Button
      variant="outline"
      size="touch"
      onClick={() =>
        void setParams({ range: widestRange, audience: widestAudience })
      }
    >
      {t('widen')}
    </Button>
  ) : null;

  const controls = (
    <Controls
      range={range}
      audience={audience}
      onRange={(next) => void setParams({ range: next })}
      onAudience={(next) => void setParams({ audience: next })}
    />
  );

  if (stats.isError) {
    return (
      <div className="flex flex-col gap-section">
        {controls}
        <LoadFailure
          title={t('failed')}
          message={errorMessage(stats.error) ?? ''}
        />
      </div>
    );
  }
  if (stats.isPending) {
    return (
      <div className="flex flex-col gap-section">
        {controls}
        <Loading />
      </div>
    );
  }

  const { series, totals, countries, cities, pages, filters } = stats.data;
  const splitConfig = {
    account: { label: t('seriesAccount'), theme: accountColor },
    anonymous: { label: t('seriesAnonymous'), theme: anonymousColor },
  } satisfies ChartConfig;
  const methodConfig = {
    password: { label: t('methodPassword'), theme: methodColors.password },
    google: { label: socialProviderNames.google, theme: methodColors.google },
    discord: {
      label: socialProviderNames.discord,
      theme: methodColors.discord,
    },
  } satisfies ChartConfig & Record<SignInMethod, unknown>;
  const splitCharts: { title: string; points: SeriesPoint[] }[] = [
    { title: t('chartSignUps'), points: series.signUps },
    { title: t('chartActiveUsers'), points: series.activeUsers },
    { title: t('chartListsCreated'), points: series.listsCreated },
    { title: t('chartListsEdited'), points: series.listsEdited },
    { title: t('chartSharesMinted'), points: series.sharesMinted },
  ];
  const signIns = series.signIns.map(({ points }) => points);
  const quiet =
    pages.length === 0 &&
    filters.length === 0 &&
    isQuiet([...splitCharts.map(({ points }) => points), ...signIns]);

  return (
    <div className="flex flex-col gap-section">
      {controls}
      <UsageTiles totals={totals} />
      <Section
        title={t('activityTitle')}
        description={t('activityDescription', {
          from: formatDate(stats.data.range.from, locale),
          to: formatDate(lastDayOf(stats.data.range.to), locale),
          bucket: stats.data.bucket,
        })}
      >
        {quiet ? (
          <EmptyState title={t('quietTitle')} actions={widen}>
            <EmptyStateText>{t('quietText')}</EmptyStateText>
          </EmptyState>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {splitCharts.map(({ title, points }) => (
              <ChartCard
                key={title}
                title={title}
                total={seriesTotal(points)}
                points={points}
                config={splitConfig}
                bucket={stats.data.bucket}
              />
            ))}
            <ChartCard
              title={t('chartSignIns')}
              total={signIns.reduce(
                (sum, points) => sum + seriesTotal(points),
                0,
              )}
              points={pointsByMethod(series.signIns)}
              config={methodConfig}
              bucket={stats.data.bucket}
            />
          </div>
        )}
      </Section>
      {!quiet && (
        <>
          <UsagePlaces countries={countries} cities={cities} widen={widen} />
          <UsageInterest pages={pages} filters={filters} widen={widen} />
        </>
      )}
    </div>
  );
}
