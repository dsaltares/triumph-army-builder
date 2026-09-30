'use client';

import { useTranslations } from 'next-intl';
import {
  type StandsChange,
  TroopOptionCard,
  troopOptionName,
} from '@/components/builder/troop-option-card';
import type {
  ContingentGroupSelection,
  ContingentSelection,
} from '@/lib/domain/army/contingent-selection';
import type {
  TroopTypeFactors,
  TroopTypeNames,
  TroopTypeProfiles,
} from '@/lib/domain/troop-types';
import { formatPoints, formatRange, formatStands } from '@/lib/format';
import type { Locale } from '@/lib/i18n/routing';
import { wordsFor } from '@/lib/i18n/translator';

export const standsAndPoints = (
  { stands, points }: ContingentGroupSelection,
  locale: Locale,
) =>
  wordsFor(locale, 'builder')('standsAndPoints', {
    stands: formatStands(stands, locale),
    points: formatPoints(points),
  });

export const whatItBrings = (
  contingents: readonly ContingentSelection[],
  troopTypeNames: TroopTypeNames,
  locale: Locale,
) =>
  contingents
    .flatMap(({ options }) =>
      options.map(
        ({ option }) =>
          `${formatRange(option.min, option.max)} ${troopOptionName(option, troopTypeNames, locale)}`,
      ),
    )
    .join(' · ');

export function ContingentOptions({
  selection,
  troopTypeNames,
  troopTypeFactors,
  troopTypeProfiles,
  onStandsChange,
}: {
  selection: ContingentSelection;
  troopTypeNames: TroopTypeNames;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
  onStandsChange: StandsChange;
}) {
  const t = useTranslations('builder');
  return selection.options.length === 0 ? (
    <p className="text-xs text-muted-foreground">
      {t('contingentOffersNothing')}
    </p>
  ) : (
    <ul className="grid gap-3 md:grid-cols-2">
      {selection.options.map((option) => (
        <TroopOptionCard
          key={option.option.id}
          selection={option}
          troopTypeNames={troopTypeNames}
          troopTypeFactors={troopTypeFactors}
          troopTypeProfiles={troopTypeProfiles}
          onStandsChange={onStandsChange}
        />
      ))}
    </ul>
  );
}
