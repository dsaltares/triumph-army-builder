'use client';

import { useLocale, useTranslations } from 'next-intl';
import { BadgeRow } from '@/components/badge-row';
import { boundsHint } from '@/components/builder/bounds-hint';
import {
  findingAnchor,
  findingAnchorClass,
} from '@/components/builder/finding-anchor';
import { Stepper } from '@/components/builder/stepper';
import {
  withholdingLabels,
  withholdingNotices,
} from '@/components/builder/withholding';
import { Notice } from '@/components/notice';
import { TroopFactors } from '@/components/troop-factors';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { TroopTypeCode } from '@/lib/data/schema';
import type { TroopOption } from '@/lib/domain/army/army-list';
import type {
  TroopOptionSelection,
  TroopStepper,
} from '@/lib/domain/army/troop-selection';
import type { BattleLine, TroopTypeMix } from '@/lib/domain/troop-options';
import type {
  CombatFactors,
  TroopTypeFactors,
  TroopTypeNames,
  TroopTypeProfile,
  TroopTypeProfiles,
} from '@/lib/domain/troop-types';
import {
  formatPoints,
  formatStandsOfRange,
  formatYearSpans,
  joinWithOr,
} from '@/lib/format';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';

export type StandsChange = (
  option: TroopOption,
  troopType: TroopTypeCode,
  stands: number,
) => void;

const battleLineLabels = {
  all: 'battleLine',
  half: 'halfBattleLine',
  none: 'notBattleLine',
} as const satisfies Record<BattleLine, string>;

const mixHints = {
  anyMix: 'anyMix',
  singleType: 'singleType',
} as const satisfies Record<TroopTypeMix, string>;

export const troopOptionName = (
  { troopEntries }: TroopOption,
  troopTypeNames: TroopTypeNames,
  locale: Locale,
) =>
  joinWithOr(
    troopEntries.map(({ troopType }) => troopTypeNames[troopType]),
    locale,
  );

const standsSummary = (
  { option, stands }: TroopOptionSelection,
  locale: Locale,
) => formatStandsOfRange(stands, option.min, option.max, locale);

function StandStepper({
  stepper,
  name,
  factors,
  profile,
  showName,
  onChange,
}: {
  stepper: TroopStepper;
  name: string;
  factors: CombatFactors;
  profile: TroopTypeProfile;
  showName: boolean;
  onChange: (stands: number) => void;
}) {
  const t = useTranslations('builder');
  const { stands, pointsPerStand, points, canAdd, canRemove } = stepper;
  return (
    <li className="flex items-center gap-2">
      <Stepper
        count={stands}
        countLabel={t('standsLabel', { name })}
        removeLabel={t('oneFewerStand', { name })}
        addLabel={t('oneMoreStand', { name })}
        canAdd={canAdd}
        canRemove={canRemove}
        onChange={onChange}
      />
      <div className="min-w-0 flex-1">
        {showName && (
          <p className="inline-flex items-center gap-1 text-sm font-medium">
            {name}
            <TroopFactors
              name={name}
              factors={factors}
              profile={profile}
              pointsPerStand={pointsPerStand}
            />
          </p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {stands > 0
            ? t('standCostWithTotal', {
                perStand: formatPoints(pointsPerStand),
                points: formatPoints(points),
              })
            : t('standCost', { perStand: formatPoints(pointsPerStand) })}
        </p>
      </div>
    </li>
  );
}

export function TroopOptionCard({
  selection,
  troopTypeNames,
  troopTypeFactors,
  troopTypeProfiles,
  onStandsChange,
}: {
  selection: TroopOptionSelection;
  troopTypeNames: TroopTypeNames;
  troopTypeFactors: TroopTypeFactors;
  troopTypeProfiles: TroopTypeProfiles;
  onStandsChange: StandsChange;
}) {
  const locale = useLocale();
  const t = useTranslations('builder');
  const { option, steppers, fill, withheldBy, mixedTypes } = selection;
  const [onlyStepper] = steppers.length === 1 ? steppers : [];
  const hint = boundsHint(
    fill,
    selection.stands,
    option.min,
    option.max,
    locale,
  );
  return (
    <li
      id={findingAnchor({ kind: 'troopOption', option: option.id })}
      className={cn('h-full', findingAnchorClass)}
    >
      <Card size="sm" className="h-full">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <h3 className="font-heading text-sm font-medium">
                    {troopOptionName(option, troopTypeNames, locale)}
                  </h3>
                  {onlyStepper && (
                    <TroopFactors
                      name={troopTypeNames[onlyStepper.troopType]}
                      factors={troopTypeFactors[onlyStepper.troopType]}
                      profile={troopTypeProfiles[onlyStepper.troopType]}
                      pointsPerStand={onlyStepper.pointsPerStand}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    fill === 'aboveMax'
                      ? 'font-medium text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {standsSummary(selection, locale)}
                  {hint && ` · ${hint}`}
                </span>
              </div>
              <Badge
                className="mt-0.5 shrink-0"
                variant={option.battleLine === 'none' ? 'outline' : 'secondary'}
              >
                {t(battleLineLabels[option.battleLine])}
              </Badge>
            </div>
            <BadgeRow
              labels={[
                option.dateRanges.length > 0 &&
                  formatYearSpans(option.dateRanges, locale),
                option.note,
              ]}
              warning={withheldBy ? t(withholdingLabels[withheldBy]) : null}
            />
            {option.description && (
              <p className="max-w-reading text-xs text-pretty text-muted-foreground">
                {option.description}
              </p>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {steppers.map((stepper) => (
              <StandStepper
                key={stepper.troopType}
                stepper={stepper}
                name={troopTypeNames[stepper.troopType]}
                factors={troopTypeFactors[stepper.troopType]}
                profile={troopTypeProfiles[stepper.troopType]}
                showName={steppers.length > 1}
                onChange={(stands) =>
                  onStandsChange(option, stepper.troopType, stands)
                }
              />
            ))}
          </ul>

          {steppers.length > 1 && !mixedTypes && (
            <p className="text-xs text-muted-foreground">
              {t(mixHints[option.mix])}
            </p>
          )}
          {mixedTypes && <Notice>{t('mixedTypes')}</Notice>}
          {withheldBy && <Notice>{t(withholdingNotices[withheldBy])}</Notice>}
        </CardContent>
      </Card>
    </li>
  );
}
