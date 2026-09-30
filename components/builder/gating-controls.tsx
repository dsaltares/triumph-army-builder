'use client';

import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useId, useMemo, useState } from 'react';
import {
  findingAnchor,
  findingAnchorClass,
} from '@/components/builder/finding-anchor';
import { troopOptionName } from '@/components/builder/troop-option-card';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderMark,
  SliderThumb,
  SliderTrack,
} from '@/components/ui/slider';
import type { ArmyList, DateRange } from '@/lib/domain/army/army-list';
import type { Gating } from '@/lib/domain/army/availability';
import {
  clampYear,
  type GatingEffect,
  type SubFactionChoice,
  subFactionChoice,
} from '@/lib/domain/army/builder';
import {
  type AvailabilityLane,
  availabilityLanes,
  type BoundaryChange,
  type GatingBoundary,
  gatingBoundaries,
  largeYearStep,
  nearestOfferedYear,
  periodIndexAt,
  yearPeriods,
} from '@/lib/domain/army/gating-boundaries';
import { triumphRules } from '@/lib/domain/army/validation';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import { formatYear, formatYearSpan, formatYearSpans } from '@/lib/format';
import type { Locale } from '@/lib/i18n/routing';
import { wordsFor } from '@/lib/i18n/translator';
import { withOverflow } from '@/lib/overflow';
import { cn } from '@/lib/utils';

type BuilderWords = ReturnType<typeof useTranslations<'builder'>>;

type GatingControlsProps = {
  armyList: ArmyList;
  gating: Gating;
  effect: GatingEffect;
  troopTypeNames: TroopTypeNames;
  onYearChange: (year: number) => void;
  onVariantChange: (variant: string | null) => void;
};

const variantHint = ({ variants }: SubFactionChoice, w: BuilderWords) => {
  const hint = w('withheldUntilAnswered');
  return variants.some(({ year }) => year !== undefined)
    ? w('withheldUntilAnsweredDated', { hint })
    : hint;
};

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 flex flex-col gap-0.5">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </legend>
      {children}
    </fieldset>
  );
}

const yearHint = (
  dateRange: DateRange,
  boundaries: readonly GatingBoundary[],
  w: BuilderWords,
) => {
  if (dateRange.startDate === dateRange.endDate) {
    return undefined;
  }
  return boundaries.length === 0 ? w('yearUnchanging') : w('yearHint');
};

const namedChanges = 2;

const changeName = (
  change: BoundaryChange,
  troopTypeNames: TroopTypeNames,
  locale: Locale,
) =>
  change.kind === 'troopOption'
    ? troopOptionName(change.troopOption, troopTypeNames, locale)
    : change.group.name;

const changeNames = (
  changes: readonly BoundaryChange[],
  troopTypeNames: TroopTypeNames,
  locale: Locale,
) =>
  withOverflow(
    [
      ...new Set(
        changes.map((change) => changeName(change, troopTypeNames, locale)),
      ),
    ],
    namedChanges,
    (count) => wordsFor(locale, 'builder')('yearMoreChanges', { count }),
  ).join(', ');

const boundaryChanges = (
  { offered, withheld }: Pick<GatingBoundary, 'offered' | 'withheld'>,
  troopTypeNames: TroopTypeNames,
  locale: Locale,
) => {
  const t = wordsFor(locale, 'builder');
  return [
    ...(offered.length > 0
      ? [
          t('yearGains', {
            names: changeNames(offered, troopTypeNames, locale),
          }),
        ]
      : []),
    ...(withheld.length > 0
      ? [
          t('yearLoses', {
            names: changeNames(withheld, troopTypeNames, locale),
          }),
        ]
      : []),
  ];
};

const yearValueText = (reachable: number, year: number, locale: Locale) =>
  reachable === year
    ? formatYear(year, locale)
    : wordsFor(locale, 'builder')('nearestYear', {
        reachable: formatYear(reachable, locale),
        year: formatYear(year, locale),
      });

const spanPosition = ({ startDate, endDate }: DateRange, year: number) =>
  Math.min(1, Math.max(0, (year - startDate) / (endDate - startDate)));

function YearSlider({
  dateRange,
  year,
  boundaries,
  onYearChange,
}: {
  dateRange: DateRange;
  year: number;
  boundaries: readonly GatingBoundary[];
  onYearChange: (year: number) => void;
}) {
  const locale = useLocale();
  const { startDate, endDate } = dateRange;
  const reachable = clampYear(dateRange, year);
  const parked = reachable !== year;

  return (
    <div className="flex flex-col gap-1">
      <Slider
        value={reachable}
        min={startDate}
        max={endDate}
        largeStep={largeYearStep(dateRange)}
        onValueChange={(value) => onYearChange(value)}
      >
        <SliderControl>
          <SliderTrack>
            <SliderIndicator
              className={parked ? 'bg-muted-foreground/40' : undefined}
            />
            {boundaries.map((boundary) => (
              <SliderMark
                key={boundary.year}
                aria-hidden
                position={spanPosition(dateRange, boundary.year)}
              />
            ))}
            <SliderThumb
              aria-label="Year"
              aria-valuetext={yearValueText(reachable, year, locale)}
              className={parked ? 'border-muted-foreground' : undefined}
            />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatYear(startDate, locale)}</span>
        <span>{formatYear(endDate, locale)}</span>
      </div>
    </div>
  );
}

function PeriodStepper({
  dateRange,
  year,
  boundaries,
  troopTypeNames,
  onYearChange,
}: {
  dateRange: DateRange;
  year: number;
  boundaries: readonly GatingBoundary[];
  troopTypeNames: TroopTypeNames;
  onYearChange: (year: number) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('builder');
  const periods = yearPeriods(dateRange, boundaries);
  const index = periodIndexAt(periods, clampYear(dateRange, year));
  const period = periods[index];
  const previous = periods[index - 1];
  const next = periods[index + 1];
  if (!period) {
    return null;
  }
  const changes = period.boundary
    ? boundaryChanges(period.boundary, troopTypeNames, locale).join(' · ')
    : t('firstPeriod');

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="touch"
        className="shrink-0 px-3 tabular-nums"
        disabled={!previous}
        aria-label={
          previous
            ? t('previousPeriod', {
                year: formatYear(previous.startDate, locale),
              })
            : t('noPreviousPeriod')
        }
        onClick={() => previous && onYearChange(previous.startDate)}
      >
        <IconChevronLeft aria-hidden />
        <span className="hidden sm:inline">
          {previous && formatYear(previous.startDate, locale)}
        </span>
      </Button>
      <p className="flex min-w-0 flex-1 flex-col items-center text-center text-xs">
        <span className="font-medium tabular-nums">
          {formatYearSpan(period, locale)}
        </span>
        <span className="text-muted-foreground">{changes}</span>
      </p>
      <Button
        variant="outline"
        size="touch"
        className="shrink-0 px-3 tabular-nums"
        disabled={!next}
        aria-label={
          next
            ? t('nextChange', { year: formatYear(next.startDate, locale) })
            : t('noNextChange')
        }
        onClick={() => next && onYearChange(next.startDate)}
      >
        <span className="hidden sm:inline">
          {next && formatYear(next.startDate, locale)}
        </span>
        <IconChevronRight aria-hidden />
      </Button>
    </div>
  );
}

type NamedLane = AvailabilityLane & { name: string; key: string };

const namedLanes = (
  lanes: readonly AvailabilityLane[],
  troopTypeNames: TroopTypeNames,
  locale: Locale,
): readonly NamedLane[] => {
  const byKey = new Map<string, NamedLane>();
  for (const lane of lanes) {
    const name = changeName(lane.change, troopTypeNames, locale);
    const key = `${name} ${formatYearSpans(lane.spans, locale)}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...lane, name, key });
    }
  }
  return [...byKey.values()];
};

const isOfferedIn = ({ spans }: AvailabilityLane, year: number) =>
  spans.some(({ startDate, endDate }) => startDate <= year && year <= endDate);

function Lane({
  lane,
  dateRange,
  year,
  onYearChange,
}: {
  lane: NamedLane;
  dateRange: DateRange;
  year: number;
  onYearChange: (year: number) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('builder');
  const offered = isOfferedIn(lane, year);
  const shownYear = formatYear(year, locale);

  return (
    <li>
      <button
        type="button"
        className="flex min-h-11 w-full flex-col gap-1 rounded-md px-1 py-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          const target = nearestOfferedYear(lane, year);
          if (target !== year) {
            onYearChange(target);
          }
        }}
      >
        <span className="flex w-full items-start gap-2 text-xs">
          <span
            className={cn(
              'flex min-w-0 items-start gap-1 font-medium',
              !offered && 'text-muted-foreground',
            )}
          >
            {offered && (
              <IconCheck aria-hidden className="mt-px size-3.5 shrink-0" />
            )}
            <span className="min-w-0 break-words">{lane.name}</span>
          </span>
          <span className="sr-only">
            {offered
              ? t('laneOffered', { year: shownYear })
              : t('laneNotOffered', { year: shownYear })}
          </span>
          <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
            {formatYearSpans(lane.spans, locale)}
          </span>
        </span>
        <span aria-hidden className="relative h-2 w-full rounded-full bg-muted">
          {lane.spans.map((span) => {
            const start = spanPosition(dateRange, span.startDate);
            const end = spanPosition(dateRange, span.endDate + 1);
            return (
              <span
                key={span.startDate}
                className={cn(
                  'absolute inset-y-0 min-w-1 rounded-full',
                  offered ? 'bg-primary' : 'bg-muted-foreground/50',
                )}
                style={{
                  insetInlineStart: `${start * 100}%`,
                  width: `${(end - start) * 100}%`,
                }}
              />
            );
          })}
          <span
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{
              insetInlineStart: `${spanPosition(dateRange, year) * 100}%`,
            }}
          />
        </span>
      </button>
    </li>
  );
}

function AvailabilityTimeline({
  lanes,
  dateRange,
  year,
  troopTypeNames,
  onYearChange,
}: {
  lanes: readonly AvailabilityLane[];
  dateRange: DateRange;
  year: number;
  troopTypeNames: TroopTypeNames;
  onYearChange: (year: number) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('builder');
  const lanesId = useId();
  const [open, setOpen] = useState(false);
  const reachable = clampYear(dateRange, year);
  const named = namedLanes(lanes, troopTypeNames, locale);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="touch"
        className="-ml-2 h-auto min-h-11 justify-start self-start px-2 text-left whitespace-normal"
        aria-expanded={open}
        aria-controls={lanesId}
        onClick={() => setOpen((was) => !was)}
      >
        <IconChevronDown
          aria-hidden
          className={cn('transition-transform', !open && '-rotate-90')}
        />
        {t('timeline', { count: named.length })}
      </Button>
      {open && (
        <div id={lanesId} className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t('timelineHint')}</p>
          <ul className="-mx-1 flex flex-col gap-1">
            {named.map((lane) => (
              <Lane
                key={lane.key}
                lane={lane}
                dateRange={dateRange}
                year={reachable}
                onYearChange={onYearChange}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function YearPicker({
  armyList,
  year,
  boundaries,
  lanes,
  troopTypeNames,
  onYearChange,
}: {
  armyList: ArmyList;
  year: number;
  boundaries: readonly GatingBoundary[];
  lanes: readonly AvailabilityLane[];
  troopTypeNames: TroopTypeNames;
  onYearChange: (year: number) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('builder');
  const { dateRange } = armyList;
  const { startDate, endDate } = dateRange;
  const hint = yearHint(dateRange, boundaries, t);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium">{t('year')}</span>
          <span className="text-sm font-medium tabular-nums">
            {formatYear(year, locale)}
          </span>
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {startDate < endDate && (
        <YearSlider
          dateRange={dateRange}
          year={year}
          boundaries={boundaries}
          onYearChange={onYearChange}
        />
      )}
      {boundaries.length > 0 && (
        <PeriodStepper
          dateRange={dateRange}
          year={year}
          boundaries={boundaries}
          troopTypeNames={troopTypeNames}
          onYearChange={onYearChange}
        />
      )}
      {lanes.length > 0 && (
        <AvailabilityTimeline
          lanes={lanes}
          dateRange={dateRange}
          year={year}
          troopTypeNames={troopTypeNames}
          onYearChange={onYearChange}
        />
      )}
    </div>
  );
}

export function GatingControls({
  armyList,
  gating,
  effect,
  troopTypeNames,
  onYearChange,
  onVariantChange,
}: GatingControlsProps) {
  const locale = useLocale();
  const t = useTranslations('builder');
  const choice = subFactionChoice(armyList, gating.variant);
  const boundaries = useMemo(
    () => gatingBoundaries(armyList, gating.variant),
    [armyList, gating.variant],
  );
  const lanes = useMemo(
    () => availabilityLanes(armyList, gating.variant),
    [armyList, gating.variant],
  );

  return (
    <Card id={findingAnchor({ kind: 'gating' })} className={findingAnchorClass}>
      <CardContent className="flex flex-col gap-6">
        <YearPicker
          armyList={armyList}
          year={gating.year}
          boundaries={boundaries}
          lanes={lanes}
          troopTypeNames={troopTypeNames}
          onYearChange={onYearChange}
        />

        {!effect.yearInRange && (
          <Notice severity="error">
            {t('outsideDateRange', {
              year: formatYear(gating.year, locale),
              span: formatYearSpan(armyList.dateRange, locale),
            })}
          </Notice>
        )}

        {choice && (
          <FieldGroup label={choice.label} hint={variantHint(choice, t)}>
            <div className="flex flex-wrap gap-2">
              {choice.variants.map(({ id, name, year }) => {
                const pressed = choice.chosen === id;
                return (
                  <Button
                    key={id}
                    variant={pressed ? 'default' : 'outline'}
                    size="touch"
                    aria-pressed={pressed}
                    onClick={() => {
                      onVariantChange(pressed ? null : id);
                      if (!pressed && year !== undefined) {
                        onYearChange(clampYear(armyList.dateRange, year));
                      }
                    }}
                  >
                    {name}
                    {year !== undefined && (
                      <span className="text-xs font-normal tabular-nums opacity-70">
                        {formatYear(year, locale)}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </FieldGroup>
        )}

        {choice && !choice.answered && (
          <Notice severity="warning">
            {t('pickAVariant', {
              label: choice.label.toLowerCase(),
              cap: triumphRules.pointsCap,
            })}
          </Notice>
        )}
      </CardContent>
    </Card>
  );
}
