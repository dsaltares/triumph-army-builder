import type {
  FantasyCardCode,
  FantasyTopography,
  TroopTypeCode,
} from '../../data/schema.ts';
import type { NamedSelection } from '../game.ts';
import { sum } from '../numbers.ts';
import {
  fantasyCardName,
  fantasyTroopTypeNames,
  unitName,
  variantNames,
} from './naming.ts';
import {
  type FantasyArmyLine,
  type FantasyCardPrice,
  fantasyPoints,
} from './points.ts';
import { type FantasyReference, fantasyCatalogue } from './reference.ts';
import type {
  FantasyCardChoice,
  FantasySelection,
} from './selection-schema.ts';

export type FantasySheetCard = {
  code: FantasyCardCode;
  name: string;
  variants: readonly string[];
  note: string | null;
};

export type FantasySheetUnit = {
  id: string;
  name: string;
  troopType: TroopTypeCode;
  troopTypeName: string;
  stands: number;
  general: boolean;
  cards: readonly FantasySheetCard[];
  delayedStands: number;
  transports: number;
  pointsPerStand: number;
  points: number;
};

export type FantasySheetHero = {
  id: string;
  name: string;
  cards: readonly FantasySheetCard[];
  delayedEntry: boolean;
  points: number;
};

export type FantasySheetArmyLine = {
  kind: 'armyCard' | 'eventCard' | 'delayedEntry';
  code: FantasyCardCode;
  name: string;
  count: number;
  variants: readonly string[];
  bearer: string | null;
  points: number | null;
};

export type FantasySheetRating = { rating: number; points: number };

export type FantasySheet = {
  listName: string;
  dataVersion: string;
  format: {
    pointsTotal: number;
    topography: FantasyTopography;
    dense: boolean;
    invasion: FantasySheetRating;
    maneuver: FantasySheetRating;
  };
  units: readonly FantasySheetUnit[];
  heroes: readonly FantasySheetHero[];
  armyCards: readonly FantasySheetArmyLine[];
  totals: {
    stands: number;
    heroes: number;
    victoryValue: number;
    total: number;
    pointsTotal: number;
  };
};

const ratingOf = (
  lines: readonly FantasyArmyLine[],
  kind: 'invasion' | 'maneuver',
): FantasySheetRating => {
  const line = lines.find(
    (candidate): candidate is Extract<FantasyArmyLine, { kind: typeof kind }> =>
      candidate.kind === kind,
  );
  return { rating: line?.rating ?? 0, points: line?.points ?? 0 };
};

export const fantasySheet = (
  { name: listName, selection }: NamedSelection<FantasySelection>,
  reference: FantasyReference,
): FantasySheet => {
  const catalogue = fantasyCatalogue(reference);
  const names = fantasyTroopTypeNames(reference);
  const points = fantasyPoints(selection, catalogue);
  const sheetCard = (
    { code, variants }: FantasyCardPrice,
    choice: FantasyCardChoice | undefined,
  ): FantasySheetCard => {
    const card = catalogue.cards.get(code);
    return {
      code,
      name: fantasyCardName(code, card),
      variants: variantNames(card, variants),
      note: choice?.note?.trim() || null,
    };
  };
  const unitNames = new Map(
    selection.units.map((unit) => [unit.id, unitName(unit, names)]),
  );
  const heroNames = new Map(
    selection.heroes.map((hero) => [hero.id, hero.name.trim()]),
  );
  const armyLine = (line: FantasyArmyLine): FantasySheetArmyLine[] => {
    switch (line.kind) {
      case 'invasion':
      case 'maneuver':
        return [];
      case 'armyCard':
      case 'eventCard': {
        const card = catalogue.cards.get(line.code);
        return [
          {
            kind: line.kind,
            code: line.code,
            name: fantasyCardName(line.code, card),
            count: line.count,
            variants: variantNames(
              card,
              line.kind === 'armyCard' ? line.variants : undefined,
            ),
            bearer:
              line.kind === 'eventCard'
                ? (unitNames.get(line.unit) ?? null)
                : null,
            points: line.points,
          },
        ];
      }
      case 'delayedEntry':
        return [
          {
            kind: 'delayedEntry',
            code: 'delayedEntry',
            name: fantasyCardName(
              'delayedEntry',
              catalogue.cards.get('delayedEntry'),
            ),
            count: line.bearer.kind === 'unit' ? line.bearer.stands : 1,
            variants: [],
            bearer:
              (line.bearer.kind === 'unit'
                ? unitNames.get(line.bearer.unit)
                : heroNames.get(line.bearer.hero)) ?? null,
            points: line.points,
          },
        ];
    }
  };
  return {
    listName,
    dataVersion: selection.dataVersion,
    format: {
      pointsTotal: selection.format.pointsTotal,
      topography: selection.format.topography,
      dense: catalogue.format.denseTopographies.includes(
        selection.format.topography,
      ),
      invasion: ratingOf(points.lines, 'invasion'),
      maneuver: ratingOf(points.lines, 'maneuver'),
    },
    units: selection.units.map((unit, index) => {
      const priced = points.units[index];
      return {
        id: unit.id,
        name: unitName(unit, names),
        troopType: unit.troopType,
        troopTypeName: names[unit.troopType],
        stands: unit.stands,
        general: unit.id === selection.general,
        cards: (priced?.cards ?? []).map((card, cardIndex) =>
          sheetCard(card, unit.cards[cardIndex]),
        ),
        delayedStands: Math.min(unit.marks.delayedEntry, unit.stands),
        transports: Math.min(unit.marks.transports, unit.stands),
        pointsPerStand: priced?.pointsPerStand ?? 0,
        points: priced?.points ?? 0,
      };
    }),
    heroes: selection.heroes.map((hero, index) => {
      const priced = points.heroes[index];
      return {
        id: hero.id,
        name: hero.name.trim(),
        cards: (priced?.cards ?? []).map((card, cardIndex) =>
          sheetCard(card, hero.cards[cardIndex]),
        ),
        delayedEntry: hero.delayedEntry,
        points: priced?.points ?? 0,
      };
    }),
    armyCards: points.lines.flatMap(armyLine),
    totals: {
      stands: sum(selection.units.map(({ stands }) => stands)),
      heroes: selection.heroes.length,
      victoryValue: points.victoryValue,
      total: points.total,
      pointsTotal: selection.format.pointsTotal,
    },
  };
};
