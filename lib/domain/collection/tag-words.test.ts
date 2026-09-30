import { describe, expect, it } from 'vitest';
import { suggestTags, type TagWord, tagWords } from './tag-words';

describe('tagWords', () => {
  it('counts each word once per option, and ranks the most used first', () => {
    expect(
      tagWords([
        { description: 'Greek hoplites, hoplites', troopTypes: ['HFT'] },
        { description: 'Mercenary hoplites', troopTypes: ['SPR', 'HFT'] },
        { description: 'Greek peltasts', troopTypes: ['LFT'] },
      ]),
    ).toEqual([
      { word: 'greek', troopTypes: ['HFT', 'LFT'], options: 2 },
      { word: 'hoplites', troopTypes: ['HFT', 'SPR'], options: 2 },
      { word: 'mercenary', troopTypes: ['HFT', 'SPR'], options: 1 },
      { word: 'peltasts', troopTypes: ['LFT'], options: 1 },
    ]);
  });

  it('keeps the spelling most descriptions use for a word and its plural', () => {
    expect(
      tagWords([
        { description: 'Hoplites', troopTypes: ['HFT'] },
        { description: 'Hoplites', troopTypes: ['HFT'] },
        { description: 'Hoplite', troopTypes: ['EFT'] },
      ]),
    ).toEqual([{ word: 'hoplites', troopTypes: ['EFT', 'HFT'], options: 3 }]);
  });

  it('leaves out the words no player would tag with', () => {
    expect(
      tagWords([
        {
          description: 'Archers of the king and 4 others',
          troopTypes: ['ARC'],
        },
      ]),
    ).toEqual([
      { word: 'archers', troopTypes: ['ARC'], options: 1 },
      { word: 'king', troopTypes: ['ARC'], options: 1 },
    ]);
  });
});

const words: TagWord[] = [
  { word: 'bowmen', troopTypes: ['ARC'], options: 40 },
  { word: 'horsemen', troopTypes: ['KNT', 'CAT'], options: 30 },
  { word: 'hoplites', troopTypes: ['HFT', 'SPR'], options: 10 },
  { word: 'horse', troopTypes: ['CAT'], options: 8 },
  { word: 'phalangites', troopTypes: ['PIK'], options: 2 },
];

describe('suggestTags', () => {
  it('offers the words that start with what the player typed, most used first', () => {
    expect(
      suggestTags(words, { typed: 'Ho', tags: [], troopType: null }),
    ).toEqual(['horsemen', 'hoplites', 'horse']);
  });

  it('puts the words of the troop type the entry fields as first', () => {
    expect(
      suggestTags(words, { typed: 'ho', tags: [], troopType: 'SPR' }),
    ).toEqual(['hoplites', 'horsemen', 'horse']);
  });

  it('offers nothing the entry is already tagged with, in either number', () => {
    expect(
      suggestTags(words, {
        typed: 'ho',
        tags: ['hoplite'],
        troopType: null,
      }),
    ).toEqual(['horsemen', 'horse']);
  });

  it('does not offer back the word exactly as typed', () => {
    expect(
      suggestTags(words, { typed: 'horse', tags: [], troopType: null }),
    ).toEqual(['horsemen']);
  });

  it('offers the most used words before anything is typed, up to a limit', () => {
    expect(
      suggestTags(words, { typed: ' ', tags: [], troopType: 'PIK' }, 2),
    ).toEqual(['phalangites', 'bowmen']);
  });
});
