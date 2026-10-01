'use client';

import { IconInfoCircle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  BaseSizesLabel,
  StandFiguresLabel,
  unknownValue,
} from '@/components/stand-basing';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { TroopTypeCategory, TroopTypeOrder } from '@/lib/data/schema';
import type { CombatFactors, TroopTypeProfile } from '@/lib/domain/troop-types';
import { formatPoints } from '@/lib/format';

const formationLabels = {
  foot: { Close: 'closeOrderFoot', Open: 'openOrderFoot' },
  mounted: { Close: 'closeOrderMounted', Open: 'openOrderMounted' },
} as const satisfies Record<TroopTypeCategory, Record<TroopTypeOrder, string>>;

const factorColumns = [
  { key: 'vFoot', factor: ({ closeCombat }) => closeCombat.vsFoot },
  { key: 'vMounted', factor: ({ closeCombat }) => closeCombat.vsMounted },
  { key: 'shoot', factor: ({ rangedCombat }) => rangedCombat.shooting },
  { key: 'shotAt', factor: ({ rangedCombat }) => rangedCombat.shotAt },
] as const satisfies readonly {
  key: string;
  factor: (factors: CombatFactors) => number;
}[];

export function TroopFactors({
  name,
  factors,
  profile,
  pointsPerStand,
}: {
  name: string;
  factors: CombatFactors;
  profile: TroopTypeProfile;
  pointsPerStand: number;
}) {
  const t = useTranslations('builder');
  const w = useTranslations('sheet');
  const columns = [
    { key: 'move' as const, value: profile.movement ?? unknownValue },
    ...factorColumns.map(({ key, factor }) => ({
      key,
      value: factor(factors),
    })),
  ];
  return (
    <Popover>
      <PopoverTrigger
        className="relative inline-flex shrink-0 rounded-sm text-muted-foreground outline-none after:absolute after:-inset-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:text-foreground"
        openOnHover
        aria-label={t('troopTypeFactors', { name })}
      >
        <IconInfoCircle className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="gap-2">
        <div className="flex flex-col gap-0.5">
          <PopoverTitle>{name}</PopoverTitle>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t(formationLabels[profile.category][profile.order])}
            {' · '}
            {t('standCost', { perStand: formatPoints(pointsPerStand) })}
          </p>
        </div>
        <dl className="grid grid-cols-5 grid-rows-[auto_auto] gap-x-2 gap-y-0.5 text-center">
          {columns.map(({ key, value }) => (
            <div key={key} className="row-span-2 grid grid-rows-subgrid">
              <dt className="self-end text-balance text-muted-foreground">
                {w(key)}
              </dt>
              <dd className="text-sm font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-muted-foreground">{t('baseSizes')}</dt>
          <dd className="tabular-nums">
            <BaseSizesLabel basing={profile.basing} />
          </dd>
          <dt className="text-muted-foreground">{t('standFigures')}</dt>
          <dd className="tabular-nums">
            <StandFiguresLabel figures={profile.basing?.figures ?? null} />
          </dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
