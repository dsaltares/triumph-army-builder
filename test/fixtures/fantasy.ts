import type { FantasyCardCode, TroopTypeCode } from '@/lib/data/schema.ts';
import type {
  FantasyCardChoice,
  FantasyHero,
  FantasySelection,
  FantasyUnit,
} from '@/lib/domain/fantasy/selection-schema.ts';
import { fixtureDataVersion } from './army.ts';

export const cards = (
  ...codes: (FantasyCardCode | FantasyCardChoice)[]
): FantasyCardChoice[] =>
  codes.map((card) => (typeof card === 'string' ? { code: card } : card));

export const fantasyUnit = (
  id: string,
  troopType: TroopTypeCode,
  overrides: Partial<Omit<FantasyUnit, 'marks'>> & {
    marks?: Partial<FantasyUnit['marks']>;
  } = {},
): FantasyUnit => {
  const { marks, ...rest } = overrides;
  return {
    id,
    name: '',
    tags: [],
    troopType,
    stands: 1,
    cards: [],
    ...rest,
    marks: { delayedEntry: 0, transports: 0, eventCards: {}, ...marks },
  };
};

export const fantasyHero = (
  id: string,
  overrides: Partial<FantasyHero> = {},
): FantasyHero => ({
  id,
  name: '',
  tags: [],
  cards: [],
  delayedEntry: false,
  ...overrides,
});

export const fantasySelection = (
  overrides: Partial<FantasySelection> = {},
): FantasySelection => ({
  dataVersion: fixtureDataVersion,
  format: { pointsTotal: 51, topography: 'Hilly', invasion: 2, maneuver: 2 },
  units: [],
  heroes: [],
  armyCards: [],
  general: null,
  ...overrides,
});
