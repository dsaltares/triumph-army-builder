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
