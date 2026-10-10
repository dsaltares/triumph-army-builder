import type {
  FantasySheet,
  FantasySheetArmyLine,
  FantasySheetCard,
  FantasySheetRating,
  FantasySheetUnit,
} from '../domain/fantasy/sheet-data.ts';
import {
  cardText,
  type FantasyTextWords,
} from '../domain/fantasy/text-export.ts';
import type { CombatFactors } from '../domain/troop-types.ts';
import {
  formatPoints,
  formatPointsWithUnit,
  formatStandCount,
  formatStands,
} from '../format.ts';
import type { Locale } from '../i18n/locales.ts';
import { type Words, wordsFor } from '../i18n/translator.ts';
import { noValue } from './sheet-layout.ts';

const factorOf =
  (pick: (factors: CombatFactors) => number) => (unit: FantasySheetUnit) =>
    unit.factors ? pick(unit.factors) : null;

export const fantasyFactorColumns = [
  { key: 'move', value: (unit: FantasySheetUnit) => unit.movement },
  { key: 'vFoot', value: factorOf(({ closeCombat }) => closeCombat.vsFoot) },
  {
    key: 'vMounted',
    value: factorOf(({ closeCombat }) => closeCombat.vsMounted),
  },
  {
    key: 'shoot',
    value: factorOf(({ rangedCombat }) => rangedCombat.shooting),
  },
  { key: 'shotAt', value: factorOf(({ rangedCombat }) => rangedCombat.shotAt) },
] as const;

export type FantasyFactorColumn = (typeof fantasyFactorColumns)[number];

export const factorCell = (
  { value }: FantasyFactorColumn,
  unit: FantasySheetUnit,
) => {
  const factor = value(unit);
  return factor === null ? noValue : `${factor}`;
};

const fantasyFactKeys = [
  'pointsTotal',
  'topography',
  'invasionRating',
  'manoeuvreRating',
  'general',
  'victoryValue',
] as const;

type FantasyFactKey = (typeof fantasyFactKeys)[number];

type FantasyFact = {
  key: FantasyFactKey;
  label: string;
  value: string;
};

export const fantasySheetWords = (locale: Locale) =>
  wordsFor(locale, 'fantasySheet');

export const fantasyTextWords = (locale: Locale): FantasyTextWords => {
  const w = fantasySheetWords(locale);
  return {
    label: (label) => w(label),
    points: (points) => formatPointsWithUnit(points, locale),
    outOf: (points, total) => pointsOutOf(points, total, locale),
    stands: (stands) => formatStands(stands, locale),
    standsOf: formatStandCount,
    topography: (topography) => topography,
  };
};

export const topographyText = ({ format }: FantasySheet, w: Words) =>
  format.dense ? `${format.topography} · ${w('dense')}` : format.topography;

const ratingText = (
  { rating, points }: FantasySheetRating,
  w: Words,
  locale: Locale,
) => w('rating', { rating, points: formatPointsWithUnit(points, locale) });

export const generalUnit = ({ units }: FantasySheet) =>
  units.find(({ general }) => general) ?? null;

const factValue = (
  key: FantasyFactKey,
  sheet: FantasySheet,
  w: Words,
  locale: Locale,
) => {
  switch (key) {
    case 'pointsTotal':
      return formatPointsWithUnit(sheet.format.pointsTotal, locale);
    case 'topography':
      return topographyText(sheet, w);
    case 'invasionRating':
      return ratingText(sheet.format.invasion, w, locale);
    case 'manoeuvreRating':
      return ratingText(sheet.format.maneuver, w, locale);
    case 'general':
      return generalUnit(sheet)?.name ?? w('notChosen');
    case 'victoryValue':
      return formatPointsWithUnit(sheet.totals.victoryValue, locale);
  }
};

export const fantasyFacts = (
  sheet: FantasySheet,
  w: Words,
  locale: Locale,
): readonly FantasyFact[] =>
  fantasyFactKeys.map((key) => ({
    key,
    label: w(key),
    value: factValue(key, sheet, w, locale),
  }));

const pointsOutOf = (points: number, total: number, locale: Locale) =>
  `${formatPoints(points)} / ${formatPointsWithUnit(total, locale)}`;

export const fantasyTotalText = ({ totals }: FantasySheet, locale: Locale) =>
  pointsOutOf(totals.total, totals.pointsTotal, locale);

export const fantasyHeadline = (sheet: FantasySheet, locale: Locale) =>
  [
    fantasyTotalText(sheet, locale),
    formatStands(sheet.totals.stands, locale),
  ].join(' · ');

export const cardsText = (cards: readonly FantasySheetCard[]) =>
  cards.map(cardText).join(', ');

export const unitMarks = (
  unit: FantasySheetUnit,
  w: Words,
  locale: Locale,
): readonly string[] => [
  ...(unit.delayedStands > 0
    ? [`${w('delayedEntry')}: ${formatStands(unit.delayedStands, locale)}`]
    : []),
  ...(unit.transports > 0
    ? [`${w('transports')}: ${formatStands(unit.transports, locale)}`]
    : []),
];

export const armyLineName = ({ name, variants, count }: FantasySheetArmyLine) =>
  `${variants.length === 0 ? name : `${name} (${variants.join(', ')})`}${count > 1 ? ` ×${count}` : ''}`;

export const armyLinePoints = ({ points }: FantasySheetArmyLine) =>
  points === null ? noValue : formatPoints(points);
