'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { ReactNode } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type {
  ContingentGroup,
  ContingentGroupId,
} from '@/lib/domain/army/army-list';
import type {
  AllyTroopOptions,
  ContingentGroupSelection,
} from '@/lib/domain/army/contingent-selection';
import type {
  TroopTypeFactors,
  TroopTypeNames,
  TroopTypeProfiles,
} from '@/lib/domain/troop-types';
import { countOf, formatPoints, formatYearSpan } from '@/lib/format';
import { cn } from '@/lib/utils';

type AllyChoice = (group: ContingentGroup | null) => void;

type AllyTroopOptionsProps = {
  allies: AllyTroopOptions;
  troopTypeNames: TroopTypeNames;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
  onChoose: AllyChoice;
  onStandsChange: StandsChange;
};

function Choice({
  value,
  name,
  chosen,
  trailing,
  children,
  body,
}: {
  value: ContingentGroupId | null;
  name: string;
  chosen: boolean;
  trailing: string | null;
  children: ReactNode;
  body: ReactNode;
}) {
  const anchor =
    value === null
      ? null
      : findingAnchor({ kind: 'contingentGroup', group: value });
  return (
    <li
      id={anchor ?? undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg p-3 ring-1',
        anchor && findingAnchorClass,
        chosen ? 'ring-2 ring-info' : 'ring-foreground/10',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Label className="min-h-6 items-start gap-2 font-heading text-sm font-medium">
            <RadioGroupItem className="mt-0.5" value={value} />
            {name}
          </Label>
          {trailing && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {trailing}
            </span>
          )}
        </div>
        {children}
      </div>
      {body}
    </li>
  );
}

function AllyChoiceCard({
  selection,
  troopTypeNames,
  troopTypeFactors,
  troopTypeProfiles,
  onStandsChange,
}: {
  selection: ContingentGroupSelection;
  troopTypeNames: TroopTypeNames;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
  onStandsChange: StandsChange;
}) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const { group, taken, offeredInYear, contingents } = selection;
  const paired = contingents.length > 1;
  return (
    <Choice
      value={group.id}
      name={group.name}
      chosen={taken}
      trailing={taken ? standsAndPoints(selection, locale) : null}
      body={
        taken &&
        contingents.map((contingent) => (
          <div key={contingent.contingent.id} className="flex flex-col gap-2">
            <h4 className="flex flex-wrap items-center gap-2 text-xs font-medium">
              {contingent.contingent.name}
              <Badge variant="outline">{t('alliedStands')}</Badge>
            </h4>
            <ContingentOptions
              selection={contingent}
              troopTypeNames={troopTypeNames}
              troopTypeFactors={troopTypeFactors}
              troopTypeProfiles={troopTypeProfiles}
              onStandsChange={onStandsChange}
            />
          </div>
        ))
      }
    >
      <BadgeRow
        labels={[
          group.dateRange && formatYearSpan(group.dateRange, locale),
          group.note,
        ]}
        warning={offeredInYear ? null : t(withholdingLabels.year)}
      />
      {paired && (
        <p className="max-w-reading text-xs text-pretty text-muted-foreground">
          {t('pairedAllies')}
        </p>
      )}
      {!taken && (
        <p className="max-w-reading text-xs text-pretty text-muted-foreground">
          {t('brings', {
            what: whatItBrings(contingents, troopTypeNames, locale),
          })}
        </p>
      )}
    </Choice>
  );
}

const describeSlot = (
  { chosen, stands, points }: AllyTroopOptions,
  t: ReturnType<typeof useTranslations<'builder'>>,
) =>
  chosen
    ? t('allySlot', {
        group: chosen.group.name,
        stands: countOf(stands, 'stand'),
        points: formatPoints(points),
      })
    : t('noAllyTaken');

export function AllyTroopOptionsSection({
  allies,
  troopTypeNames,
  troopTypeFactors,
  troopTypeProfiles,
  onChoose,
  onStandsChange,
}: AllyTroopOptionsProps) {
  const t = useTranslations('builder');
  const { groups, offered, chosen, withheld } = allies;
  if (offered === 0) {
    return null;
  }
  return (
    <Section title={t('allyTroopOptions')} description={t('allyDescription')}>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noAllyOffered')}</p>
      ) : (
        <RadioGroup
          aria-label={t('alliedContingent')}
          value={chosen?.group.id ?? null}
          onValueChange={(value: ContingentGroupId | null) =>
            onChoose(
              groups.find(({ group }) => group.id === value)?.group ?? null,
            )
          }
        >
          <ul className="flex flex-col gap-3">
            <Choice
              value={null}
              name={t('noAlly')}
              chosen={chosen === null}
              trailing={null}
              body={null}
            >
              <p className="max-w-reading text-xs text-pretty text-muted-foreground">
                {t('ownTroopsOnly')}
              </p>
            </Choice>
            {groups.map((selection) => (
              <AllyChoiceCard
                key={selection.group.id}
                selection={selection}
                troopTypeNames={troopTypeNames}
                troopTypeFactors={troopTypeFactors}
                troopTypeProfiles={troopTypeProfiles}
                onStandsChange={onStandsChange}
              />
            ))}
          </ul>
        </RadioGroup>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {describeSlot(allies, t)}
        {withheld > 0 && t('alliesNotOffered', { count: withheld })}
      </p>
    </Section>
  );
}
