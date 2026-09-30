'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useId } from 'react';
import { BadgeRow } from '@/components/badge-row';
import {
  ContingentOptions,
  standsAndPoints,
  whatItBrings,
} from '@/components/builder/contingent-options';
import {
  findingAnchor,
  findingAnchorClass,
} from '@/components/builder/finding-anchor';
import type { StandsChange } from '@/components/builder/troop-option-card';
import { withholdingLabels } from '@/components/builder/withholding';
import { Section } from '@/components/layout/section';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ContingentGroup } from '@/lib/domain/army/army-list';
import type {
  ContingentGroupSelection,
  OptionalContingents,
} from '@/lib/domain/army/contingent-selection';
import type {
  TroopTypeFactors,
  TroopTypeNames,
  TroopTypeProfiles,
} from '@/lib/domain/troop-types';
import { formatPoints, formatYearSpan } from '@/lib/format';
import { cn } from '@/lib/utils';

type ContingentToggle = (group: ContingentGroup, taken: boolean) => void;

type OptionalContingentsProps = {
  contingents: OptionalContingents;
  troopTypeNames: TroopTypeNames;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
  onToggle: ContingentToggle;
  onStandsChange: StandsChange;
};

function ContingentGroupCard({
  selection,
  troopTypeNames,
  troopTypeFactors,
  troopTypeProfiles,
  onToggle,
  onStandsChange,
}: {
  selection: ContingentGroupSelection;
  troopTypeNames: TroopTypeNames;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
  onToggle: ContingentToggle;
  onStandsChange: StandsChange;
}) {
  const t = useTranslations('builder');
  const toggleId = useId();
  const locale = useLocale();
  const { group, taken, offeredInYear, contingents } = selection;
  const paired = contingents.length > 1;
  return (
    <li
      id={findingAnchor({ kind: 'contingentGroup', group: group.id })}
      className={cn(
        'flex flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/10',
        findingAnchorClass,
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Label
            htmlFor={toggleId}
            className="min-h-6 items-start gap-2 font-heading text-sm font-medium"
          >
            <Switch
              id={toggleId}
              className="mt-0.5"
              checked={taken}
              onCheckedChange={(checked) => onToggle(group, checked)}
            />
            {group.name}
          </Label>
          {taken && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {standsAndPoints(selection, locale)}
            </span>
          )}
        </div>
        <BadgeRow
          labels={[
            group.dateRange && formatYearSpan(group.dateRange, locale),
            group.note,
          ]}
          warning={offeredInYear ? null : t(withholdingLabels.year)}
        />
        {paired && (
          <p className="text-xs text-muted-foreground">
            {t('pairedContingents')}
          </p>
        )}
        {!taken && (
          <p className="max-w-reading text-xs text-pretty text-muted-foreground">
            {t('brings', {
              what: whatItBrings(contingents, troopTypeNames, locale),
            })}
          </p>
        )}
      </div>

      {taken &&
        contingents.map((contingent) => (
          <div key={contingent.contingent.id} className="flex flex-col gap-2">
            {paired && (
              <h4 className="text-xs font-medium">
                {contingent.contingent.name}
              </h4>
            )}
            <ContingentOptions
              selection={contingent}
              troopTypeNames={troopTypeNames}
              troopTypeFactors={troopTypeFactors}
              troopTypeProfiles={troopTypeProfiles}
              onStandsChange={onStandsChange}
            />
          </div>
        ))}
    </li>
  );
}

export function OptionalContingentsSection({
  contingents,
  troopTypeNames,
  troopTypeFactors,
  troopTypeProfiles,
  onToggle,
  onStandsChange,
}: OptionalContingentsProps) {
  const t = useTranslations('builder');
  const { groups, offered, taken, stands, points, withheld } = contingents;
  if (offered === 0) {
    return null;
  }
  return (
    <Section
      title={t('optionalContingents')}
      description={t('optionalDescription')}
    >
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('noOptionalOffered')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((selection) => (
            <ContingentGroupCard
              key={selection.group.id}
              selection={selection}
              troopTypeNames={troopTypeNames}
              troopTypeFactors={troopTypeFactors}
              troopTypeProfiles={troopTypeProfiles}
              onToggle={onToggle}
              onStandsChange={onStandsChange}
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {t('optionalSummary', {
          taken,
          offered,
          stands,
          points: formatPoints(points),
        })}
        {withheld > 0 && t('contingentsNotOffered', { count: withheld })}
      </p>
    </Section>
  );
}
