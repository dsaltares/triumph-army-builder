import { ascending, byKey } from '../ordering.ts';
import type {
  FantasyArmyCard,
  FantasyCardChoice,
  FantasyHero,
  FantasySelection,
  FantasyUnit,
} from './selection-schema.ts';

type Variants = Readonly<Record<string, string>> | undefined;

const canonicalVariants = (variants: Variants) => {
  const entries = Object.entries(variants ?? {}).sort(byKey);
  return entries.length === 0 ? {} : { variants: Object.fromEntries(entries) };
};

const canonicalNote = (note: string | undefined) => {
  const trimmed = note?.trim() ?? '';
  return trimmed === '' ? {} : { note: trimmed };
};

const canonicalCards = (
  cards: readonly FantasyCardChoice[],
): FantasyCardChoice[] =>
  cards
    .map(({ code, variants, note }) => ({
      code,
      ...canonicalVariants(variants),
      ...canonicalNote(note),
    }))
    .sort((left, right) =>
      ascending(JSON.stringify(left), JSON.stringify(right)),
    );

const canonicalTags = (tags: readonly string[]) =>
  [...new Set(tags)].sort(ascending);

const canonicalUnit = (unit: FantasyUnit): FantasyUnit => ({
  id: unit.id,
  name: unit.name,
  tags: canonicalTags(unit.tags),
  troopType: unit.troopType,
  stands: unit.stands,
  cards: canonicalCards(unit.cards),
  marks: {
    delayedEntry: unit.marks.delayedEntry,
    transports: unit.marks.transports,
    eventCards: Object.fromEntries(
      Object.entries(unit.marks.eventCards)
        .filter(([, count]) => typeof count === 'number' && count > 0)
        .sort(byKey),
    ),
  },
});

const canonicalHero = (hero: FantasyHero): FantasyHero => ({
  id: hero.id,
  name: hero.name,
  tags: canonicalTags(hero.tags),
  cards: canonicalCards(hero.cards),
  delayedEntry: hero.delayedEntry,
});

const canonicalArmyCard = ({
  code,
  count,
  variants,
}: FantasyArmyCard): FantasyArmyCard => ({
  code,
  ...(count === undefined || count === 1 ? {} : { count }),
  ...canonicalVariants(variants),
});

export const canonicalFantasySelection = (
  selection: FantasySelection,
): FantasySelection => ({
  dataVersion: selection.dataVersion,
  format: {
    pointsTotal: selection.format.pointsTotal,
    topography: selection.format.topography,
    invasion: selection.format.invasion,
    maneuver: selection.format.maneuver,
  },
  units: selection.units.map(canonicalUnit),
  heroes: selection.heroes.map(canonicalHero),
  armyCards: selection.armyCards
    .map(canonicalArmyCard)
    .sort((left, right) =>
      ascending(JSON.stringify(left), JSON.stringify(right)),
    ),
  general: selection.general,
});
