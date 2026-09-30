'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { Section } from '@/components/layout/section';
import type { AudienceSplit, UsageTotals } from '@/lib/db/usage-totals';
import { formatCount } from '@/lib/format';

const tileKeys = {
  users: 'tileUsers',
  lists: 'tileLists',
  shares: 'tileShares',
  collectionEntries: 'tileCollectionEntries',
} as const satisfies Record<keyof UsageTotals, string>;

function Tile({ label, split }: { label: string; split: AudienceSplit }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const labelId = useId();
  return (
    <section
      aria-labelledby={labelId}
      className="flex flex-col gap-1 rounded-lg bg-card p-4 ring-1 ring-foreground/10"
    >
      <p id={labelId} className="text-xs text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-2xl font-semibold tabular-nums">
        {formatCount(split.account + split.anonymous, locale)}
      </p>
      <p className="text-xs text-pretty text-muted-foreground">
        {t('tileSplit', {
          account: formatCount(split.account, locale),
          anonymous: formatCount(split.anonymous, locale),
        })}
      </p>
    </section>
  );
}

export function UsageTiles({ totals }: { totals: UsageTotals }) {
  const t = useTranslations('admin');
  return (
    <Section title={t('totalsTitle')} description={t('totalsDescription')}>
      <div className="grid grid-cols-1 gap-3 min-[22rem]:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(tileKeys) as (keyof UsageTotals)[]).map((key) => (
          <Tile key={key} label={t(tileKeys[key])} split={totals[key]} />
        ))}
      </div>
    </Section>
  );
}
