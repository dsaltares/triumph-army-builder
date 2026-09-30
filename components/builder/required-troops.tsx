'use client';

import { useTranslations } from 'next-intl';
import {
  type StandsChange,
  TroopOptionCard,
} from '@/components/builder/troop-option-card';
import { Section } from '@/components/layout/section';
import type { RequiredTroops } from '@/lib/domain/army/troop-selection';
import type {
  TroopTypeFactors,
  TroopTypeNames,
  TroopTypeProfiles,
} from '@/lib/domain/troop-types';
import { formatPoints } from '@/lib/format';

export function RequiredTroopsSection({
  troops,
  troopTypeNames,
  troopTypeFactors,
  troopTypeProfiles,
  onStandsChange,
}: {
  troops: RequiredTroops;
  troopTypeNames: TroopTypeNames;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
  onStandsChange: StandsChange;
}) {
  const t = useTranslations('builder');
  const { options, stands, points, withheld } = troops;
  return (
    <Section title={t('requiredTroops')}>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTroopOptions')}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {options.map((selection) => (
            <TroopOptionCard
              key={selection.option.id}
              selection={selection}
              troopTypeNames={troopTypeNames}
              troopTypeFactors={troopTypeFactors}
              troopTypeProfiles={troopTypeProfiles}
              onStandsChange={onStandsChange}
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {t('requiredSummary', { stands, points: formatPoints(points) })}
        {withheld > 0 && t('requiredWithheld', { count: withheld })}
      </p>
    </Section>
  );
}
