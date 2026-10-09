import { beforeAll, describe, expect, it } from 'vitest';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import type { FantasyCardCode } from './data/schema.ts';
import { fantasyCardName, unitName } from './domain/fantasy/naming.ts';
import {
  type FantasyCatalogue,
  fantasyCatalogue,
} from './domain/fantasy/reference.ts';
import type { FantasySelection } from './domain/fantasy/selection-schema.ts';
import {
  type FantasyFinding,
  validateFantasyList,
} from './domain/fantasy/validation.ts';
import { troopTypeNames } from './domain/troop-types.ts';
import {
  describeFantasyFinding,
  type FantasyFindingNames,
  type FantasyFindingTranslator,
} from './fantasy-findings.ts';
import { joinWithAnd } from './format.ts';
import { locales } from './i18n/locales.ts';
import { wordsFor } from './i18n/translator.ts';

let catalogue: FantasyCatalogue;

beforeAll(async () => {
  catalogue = fantasyCatalogue(await sampleFantasyReference());
});

const namesFor = (selection: FantasySelection): FantasyFindingNames => ({
  card: (code: FantasyCardCode) =>
    fantasyCardName(code, catalogue.cards.get(code)),
  unit: (id) => {
    const unit = selection.units.find((candidate) => candidate.id === id);
    return unit
      ? unitName(unit, troopTypeNames([...catalogue.troopTypes.values()]))
      : id;
  },
  hero: (id) =>
    selection.heroes.find((candidate) => candidate.id === id)?.name ?? id,
  army: 'the army',
  join: (items) => joinWithAnd(items, 'en'),
});

const broken = fantasySelection({
  format: { pointsTotal: 12, topography: 'Arable', invasion: 2, maneuver: 2 },
  units: [
    fantasyUnit('wargs', 'JCV', {
      name: 'Warg riders',
      stands: 2,
      cards: cards('fierce', 'craven', 'fierce', 'flying', 'brittle', 'slow'),
      marks: {
        delayedEntry: 5,
        eventCards: { chargeThrough: 9, ambush: 1 },
      },
    }),
    fantasyUnit('wolves', 'JCV', {
      marks: { eventCards: { chargeThrough: 1 } },
    }),
  ],
  heroes: [
    fantasyHero('a', { name: 'Shaman', cards: cards('marksman', 'fierce') }),
    fantasyHero('b', { delayedEntry: true }),
    fantasyHero('c', { delayedEntry: true }),
    fantasyHero('d', { cards: cards('deadly', 'deadly', 'deadly') }),
  ],
  armyCards: [
    { code: 'delayedEntry' },
    { code: 'fortifiedCamp' },
    { code: 'fortifiedCamp' },
    { code: 'illusion', count: 9 },
  ],
  general: 'a',
});

const translators = locales.map(
  (locale) =>
    [
      locale,
      wordsFor(
        locale,
        'fantasyFindings',
      ) as unknown as FantasyFindingTranslator,
    ] as const,
);

describe('describeFantasyFinding', () => {
  it('words every finding a broken list raises, in every language', () => {
    const findings = validateFantasyList(broken, catalogue);
    const codes = new Set(findings.map(({ code }) => code));

    expect(codes.size).toBeGreaterThan(15);
    for (const [, t] of translators) {
      for (const finding of findings) {
        const text = describeFantasyFinding(finding, t, namesFor(broken));
        expect(text).not.toMatch(/[{}]|fantasyFindings/);
      }
    }
  });

  it('names the cards and the unit a finding is about', () => {
    const finding = validateFantasyList(broken, catalogue).find(
      (candidate): candidate is FantasyFinding =>
        candidate.code === 'cardsExcludeEachOther',
    );
    if (!finding) {
      throw new Error('the broken list no longer mixes Craven and Fierce');
    }
    const [, english] = translators[0] ?? [];
    if (!english) {
      throw new Error('there is no first locale');
    }

    expect(describeFantasyFinding(finding, english, namesFor(broken))).toBe(
      'Warg riders may not take both Craven and Fierce',
    );
  });
});
