import type { Contingent } from '../domain/army/army-list.ts';
import {
  type ArmySheet,
  type SheetBattleCard,
  type SheetContingent,
  type SheetFactKey,
  type SheetStandColumn,
  type SheetStandLine,
  sheetFactKeys,
} from '../domain/army/sheet.ts';
import type { BattleLine } from '../domain/troop-options.ts';
import {
  formatPoints,
  formatRatings,
  formatStands,
  formatTopographies,
  formatYear,
  formatYearSpan,
} from '../format.ts';
import { campText } from '../i18n/camp.ts';
import type { Locale } from '../i18n/locales.ts';
import type { Words } from '../i18n/translator.ts';

export type SheetFact = {
  key: SheetFactKey;
  label: string;
  value: string;
};

export const battleLineLabels: Readonly<Record<BattleLine, string | null>> = {
  all: 'battleLine',
  half: 'halfBattleLine',
  none: null,
};

const contingentKindLabels: Readonly<Record<Contingent['kind'], string>> = {
  main: 'mainContingent',
  optional: 'optionalContingent',
  allied: 'alliedContingent',
};

export const noValue = '—';

export const standCell = (column: SheetStandColumn, line: SheetStandLine) => {
  const value = column.value(line);
  if (value === null) {
    return noValue;
  }
  return column.kind === 'points' ? formatPoints(value) : `${value}`;
};

export const cardStandsCell = ({ stands }: SheetBattleCard) =>
  stands > 0 ? `${stands}` : noValue;

export const describeContingent = (
  { kind, stands, points }: SheetContingent,
  w: Words,
  locale: Locale,
) =>
  `${w(contingentKindLabels[kind])} · ${formatStands(stands, locale)} · ${formatPoints(points)}`;

const factOf = (
  key: SheetFactKey,
  sheet: ArmySheet,
  w: Words,
  locale: Locale,
): SheetFact | null => {
  switch (key) {
    case 'army':
      return {
        key,
        label: w('army'),
        value: `${sheet.armyName}, ${formatYearSpan(sheet.dateRange, locale)}`,
      };
    case 'year':
      return { key, label: w('year'), value: formatYear(sheet.year, locale) };
    case 'subFaction':
      return sheet.subFaction
        ? {
            key,
            label: sheet.subFaction.label,
            value: sheet.subFaction.name ?? w('notChosen'),
          }
        : null;
    case 'general':
      return {
        key,
        label: w('general'),
        value: sheet.general
          ? `${sheet.general.name} — ${sheet.general.contingent}`
          : w('notChosen'),
      };
    case 'camp':
      return { key, label: w('camp'), value: campText(sheet.camp, w) };
    case 'invasionRating':
      return {
        key,
        label: w('invasionRating'),
        value: formatRatings(sheet.invasionRatings),
      };
    case 'manoeuvreRating':
      return {
        key,
        label: w('manoeuvreRating'),
        value: formatRatings(sheet.maneuverRatings),
      };
    case 'homeTopography':
      return {
        key,
        label: w('homeTopography'),
        value: formatTopographies(sheet.homeTopographies),
      };
  }
};

export const sheetFacts = (
  sheet: ArmySheet,
  w: Words,
  locale: Locale,
): readonly SheetFact[] =>
  sheetFactKeys.flatMap((key) => {
    const fact = factOf(key, sheet, w, locale);
    return fact ? [fact] : [];
  });
