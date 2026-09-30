import { beforeAll, describe, expect, it } from 'vitest';
import { sampleSnapshot } from '@/test/sample.ts';
import {
  descriptionWords,
  tagMatcher,
  tagMatchesDescription,
  tagSuggestions,
} from './description-words';

describe('descriptionWords', () => {
  it('lowercases, folds accents and drops a trailing s', () => {
    expect(descriptionWords('Almogàvares, Hoplites')).toEqual([
      'almogavare',
      'hoplite',
    ]);
  });

  it('keeps a possessive as one word', () => {
    expect(descriptionWords("King's guard")).toEqual(['king', 'guard']);
  });

  it('splits on hyphens and digits stay words', () => {
    expect(descriptionWords('4-wheeled battle cars')).toEqual([
      '4',
      'wheeled',
      'battle',
      'car',
    ]);
  });
});

describe('tagMatchesDescription', () => {
  it('matches a tag written as a phrase only in order', () => {
    expect(
      tagMatchesDescription('mercenary hoplites', 'Greek mercenary hoplites'),
    ).toBe(true);
    expect(
      tagMatchesDescription('hoplites mercenary', 'Greek mercenary hoplites'),
    ).toBe(false);
  });

  it('never matches an empty tag', () => {
    expect(tagMatchesDescription(' - ', 'Hoplites')).toBe(false);
  });
});

describe('tagMatcher', () => {
  it('says which tag lists match a description, in their order', () => {
    const matches = tagMatcher([
      ['pike'],
      ['mercenary hoplites', 'spartan'],
      [],
    ]);

    expect(matches('Greek mercenary hoplites')).toEqual([false, true, false]);
    expect(matches('Spartan citizens')).toEqual([false, true, false]);
  });

  it('agrees with tagMatchesDescription on every tag', () => {
    const tags = ['hoplite', 'pike', 'greek'];
    const matches = tagMatcher(tags.map((tag) => [tag]));

    expect(matches('Greek hoplite mercenaries')).toEqual(
      tags.map((tag) =>
        tagMatchesDescription(tag, 'Greek hoplite mercenaries'),
      ),
    );
  });
});

describe('tagSuggestions', () => {
  it('offers the words that describe the troops, as they are written', () => {
    expect(tagSuggestions('Sumerian spearmen', [])).toEqual([
      'sumerian',
      'spearmen',
    ]);
  });

  it('leaves out the words that connect the others', () => {
    expect(
      tagSuggestions('Infantry armed with small clubs and spears', []),
    ).toEqual(['infantry', 'small', 'clubs']);
  });

  it('leaves out numbers, short words and repeats', () => {
    expect(tagSuggestions('2-horse chariots or 4-horse chariots', [])).toEqual([
      'horse',
      'chariots',
    ]);
  });

  it('leaves out what the entry is already tagged with, in either number', () => {
    expect(tagSuggestions('Greek mercenary hoplites', ['hoplite'])).toEqual([
      'greek',
      'mercenary',
    ]);
  });

  it('offers a word that would turn the stand-in into a match', () => {
    const description = 'Noble heavy horsemen';

    for (const tag of tagSuggestions(description, [])) {
      expect(tagMatchesDescription(tag, description)).toBe(true);
    }
  });
});

describe('against the sample snapshot', () => {
  let descriptions: ReadonlySet<string>;

  beforeAll(async () => {
    const snapshot = await sampleSnapshot();
    descriptions = new Set(
      [...snapshot.armyLists, ...snapshot.allyArmyLists].flatMap(
        ({ troopOptions }) =>
          troopOptions.map(({ description }) => description),
      ),
    );
  });

  it.each([
    ['chariot', '2-horse chariots of the sun', true],
    ['chariots', '2-horse chariots of the sun', true],
    ['Horde', 'Risen hordes', true],
    ['chariots of the sun', '2-horse chariots of the sun', true],
    ['sun', 'Later sun-guard, close-fighters with axe and shield', true],
    ['pike', 'Ember pike-blocks', true],
    ['crown', 'Crown pikemen and spear-militia', true],
    ['pikemen', 'Crown pikemen and spear-militia', true],
    ['pike', 'Crown pikemen and spear-militia', false],
    ['spear', 'Oathsworn spear-dancers', true],
    ['hor', 'Risen hordes', false],
    [
      'close-fighters',
      'Later sun-guard, close-fighters with axe and shield',
      true,
    ],
    [
      'shield and axe',
      'Later sun-guard, close-fighters with axe and shield',
      false,
    ],
  ])('%s against %s is %s', (tag, description, expected) => {
    expect(descriptions.has(description)).toBe(true);
    expect(tagMatchesDescription(tag, description)).toBe(expected);
  });
});
