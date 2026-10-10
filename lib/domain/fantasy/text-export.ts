import type {
  FantasySheet,
  FantasySheetArmyLine,
  FantasySheetCard,
  FantasySheetHero,
  FantasySheetRating,
  FantasySheetUnit,
} from './sheet-data.ts';

export type FantasyTextItem = {
  text: string;
  children: readonly string[];
};

export type FantasyTextBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string; meta?: string }
  | { kind: 'line'; text: string; strong?: boolean }
  | { kind: 'list'; items: readonly FantasyTextItem[] };

export type FantasyTextLabel =
  | 'pointsTotal'
  | 'topography'
  | 'dense'
  | 'invasionRating'
  | 'manoeuvreRating'
  | 'units'
  | 'noUnits'
  | 'heroes'
  | 'hero'
  | 'noHeroes'
  | 'armyCards'
  | 'noArmyCards'
  | 'general'
  | 'perStand'
  | 'delayedEntry'
  | 'transports'
  | 'unpriced'
  | 'victoryValue'
  | 'total';

export type FantasyTextWords = {
  label: (label: FantasyTextLabel) => string;
  points: (points: number) => string;
  outOf: (points: number, total: number) => string;
  stands: (stands: number) => string;
  standsOf: (stands: number, troopType: string) => string;
  topography: (topography: string) => string;
};

const item = (
  text: string,
  children: readonly string[] = [],
): FantasyTextItem => ({ text, children });

export const cardText = ({
  name,
  variants,
  note = null,
}: Pick<FantasySheetCard, 'name' | 'variants'> & {
  note?: FantasySheetCard['note'];
}) => {
  const details = [...variants, ...(note === null ? [] : [note])];
  return details.length === 0 ? name : `${name} (${details.join(', ')})`;
};

const cardsLine = (cards: readonly FantasySheetCard[]) =>
  cards.length === 0 ? [] : [cards.map(cardText).join(', ')];

const ratingText = (
  { rating, points }: FantasySheetRating,
  w: FantasyTextWords,
) => `${rating} · ${w.points(points)}`;

const formatItems = (
  { format }: FantasySheet,
  w: FantasyTextWords,
): readonly FantasyTextItem[] => [
  item(`${w.label('pointsTotal')}: ${w.points(format.pointsTotal)}`),
  item(
    `${w.label('topography')}: ${w.topography(format.topography)}${format.dense ? ` · ${w.label('dense')}` : ''}`,
  ),
  item(`${w.label('invasionRating')}: ${ratingText(format.invasion, w)}`),
  item(`${w.label('manoeuvreRating')}: ${ratingText(format.maneuver, w)}`),
];

const unitItem = (unit: FantasySheetUnit, w: FantasyTextWords) =>
  item(
    [
      `${unit.name} — ${w.standsOf(unit.stands, unit.troopTypeName)}`,
      ...(unit.general ? [w.label('general')] : []),
      w.points(unit.points),
    ].join(' · '),
    [
      ...cardsLine(unit.cards),
      `${w.points(unit.pointsPerStand)} ${w.label('perStand')}`,
      ...(unit.delayedStands > 0
        ? [`${w.label('delayedEntry')}: ${w.stands(unit.delayedStands)}`]
        : []),
      ...(unit.transports > 0
        ? [`${w.label('transports')}: ${w.stands(unit.transports)}`]
        : []),
    ],
  );

export const heroLabel = (
  { name }: FantasySheetHero,
  index: number,
  numbered: string,
) => name || `${numbered} ${index + 1}`;

const heroItem = (hero: FantasySheetHero, index: number, w: FantasyTextWords) =>
  item(
    `${heroLabel(hero, index, w.label('hero'))} — ${w.points(hero.points)}`,
    [
      ...cardsLine(hero.cards),
      ...(hero.delayedEntry ? [w.label('delayedEntry')] : []),
    ],
  );

const armyCardItem = (line: FantasySheetArmyLine, w: FantasyTextWords) =>
  item(
    [
      `${cardText(line)}${line.count > 1 ? ` ×${line.count}` : ''}`,
      ...(line.bearer ? [line.bearer] : []),
      line.points === null ? w.label('unpriced') : w.points(line.points),
    ].join(' — '),
  );

const section = <Row>(
  heading: string,
  rows: readonly Row[],
  empty: string,
  toItem: (row: Row, index: number) => FantasyTextItem,
): readonly FantasyTextBlock[] => [
  { kind: 'heading', text: heading },
  rows.length === 0
    ? { kind: 'line', text: empty }
    : { kind: 'list', items: rows.map(toItem) },
];

export const fantasyTextGroups = (
  sheet: FantasySheet,
  w: FantasyTextWords,
): readonly (readonly FantasyTextBlock[])[] => [
  [
    { kind: 'title', text: sheet.listName },
    {
      kind: 'line',
      strong: true,
      text: [
        `${w.label('total')}: ${w.outOf(sheet.totals.total, sheet.totals.pointsTotal)}`,
        `${w.label('victoryValue')}: ${w.points(sheet.totals.victoryValue)}`,
        w.stands(sheet.totals.stands),
      ].join(' · '),
    },
  ],
  [{ kind: 'list', items: formatItems(sheet, w) }],
  section(w.label('units'), sheet.units, w.label('noUnits'), (unit) =>
    unitItem(unit, w),
  ),
  section(w.label('heroes'), sheet.heroes, w.label('noHeroes'), (hero, index) =>
    heroItem(hero, index, w),
  ),
  section(
    w.label('armyCards'),
    sheet.armyCards,
    w.label('noArmyCards'),
    (line) => armyCardItem(line, w),
  ),
];
