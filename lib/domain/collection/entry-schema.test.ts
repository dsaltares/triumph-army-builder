import { describe, expect, it } from 'vitest';
import {
  collectionEntryFormSchema,
  entryNotesMaxLength,
  entryTagLimit,
  entryTagMaxLength,
  normaliseTags,
} from './entry-schema.ts';

const phalangites = {
  name: 'Macedonian phalangites',
  count: 8,
  troopType: 'PIK',
  tags: ['macedonian', 'pike'],
  status: 'painted',
  notes: '',
};

const refusal = (overrides: object) =>
  collectionEntryFormSchema
    .safeParse({ ...phalangites, ...overrides })
    .error?.issues.map(({ message }) => message);

describe('normaliseTags', () => {
  it('trims, lowercases, drops blanks and keeps the first of each tag', () => {
    expect(normaliseTags([' Pike', 'MACEDONIAN', '', 'pike ', '  '])).toEqual([
      'pike',
      'macedonian',
    ]);
  });
});

describe('collectionEntryFormSchema', () => {
  it('accepts an entry the form would send', () => {
    expect(collectionEntryFormSchema.parse(phalangites)).toEqual(phalangites);
  });

  it.each([
    ['a name that is only whitespace', { name: '  ' }, 'nameYourEntry'],
    ['an entry with no stands', { count: 0 }, 'countAtLeastOne'],
    ['a fraction of a stand', { count: 2.5 }, 'countAtLeastOne'],
    ['no troop type', { troopType: null }, 'pickATroopType'],
    [
      'a count the number field could not read',
      { count: Number.NaN },
      'countAtLeastOne',
    ],
    [
      'a tag longer than a word',
      { tags: ['a'.repeat(entryTagMaxLength + 1)] },
      'tagTooLong',
    ],
    [
      'more tags than can mean anything',
      { tags: Array.from({ length: entryTagLimit + 1 }, (_, n) => `tag${n}`) },
      'tooManyTags',
    ],
    [
      'notes longer than the form allows',
      { notes: 'a'.repeat(entryNotesMaxLength + 1) },
      'notesTooLong',
    ],
  ])('refuses %s', (_, overrides, message) => {
    expect(refusal(overrides)).toEqual([message]);
  });

  it('counts the tags after folding their duplicates together', () => {
    const tags = Array.from({ length: entryTagLimit }, (_, n) => `tag${n}`);

    expect(
      collectionEntryFormSchema.safeParse({
        ...phalangites,
        tags: [...tags, ...tags.map((tag) => tag.toUpperCase())],
      }).success,
    ).toBe(true);
  });

  it('takes stands when the kind is left out', () => {
    expect(
      collectionEntryFormSchema.parse({ ...phalangites, kind: 'stands' }),
    ).toEqual({ ...phalangites, kind: 'stands' });
    expect(refusal({ kind: 'stands', troopType: null })).toEqual([
      'pickATroopType',
    ]);
  });

  it('accepts a hero with no troop type', () => {
    const hero = { ...phalangites, kind: 'hero', troopType: null };

    expect(collectionEntryFormSchema.parse(hero)).toEqual(hero);
  });

  it('refuses a hero that fields as a troop type', () => {
    expect(refusal({ kind: 'hero' })).toEqual(['heroHasNoTroopType']);
  });

  it('keeps the games in their own order, once each', () => {
    expect(
      collectionEntryFormSchema.parse({
        ...phalangites,
        games: ['fantasy', 'triumph', 'fantasy'],
      }).games,
    ).toEqual(['triumph', 'fantasy']);
  });

  it('refuses stands of no game', () => {
    expect(refusal({ games: [] })).toEqual(['pickAGame']);
  });

  it('refuses a hero of any game but Fantasy Triumph', () => {
    expect(
      refusal({ kind: 'hero', troopType: null, games: ['triumph', 'fantasy'] }),
    ).toEqual(['heroIsFantasyOnly']);
  });

  it('says what else is missing beside the troop type', () => {
    expect(refusal({ name: '', troopType: null })).toEqual([
      'nameYourEntry',
      'pickATroopType',
    ]);
  });

  it('refuses a kind it does not know', () => {
    expect(refusal({ kind: 'regiment' })).toHaveLength(1);
  });

  it('refuses a troop type code the game does not have', () => {
    expect(
      collectionEntryFormSchema
        .safeParse({
          ...phalangites,
          troopType: 'XYZ',
        })
        .error?.issues.map(({ message }) => message),
    ).toEqual(['pickATroopType']);
  });
});
