import { describe, expect, it } from 'vitest';
import { nameSearch } from './name-search.ts';

const categories = [
  { id: 'k1', name: 'Cradle of Civilization' },
  { id: 'k2', name: 'Rise of Rome' },
  { id: 'k3', name: 'Fall of Rome' },
  { id: 'k4', name: 'Pax Romana' },
  { id: 'k5', name: 'Corsair Seas' },
];

const names = (items: readonly { name: string }[]) =>
  items.map(({ name }) => name);

describe('nameSearch', () => {
  const search = nameSearch(categories);

  it('answers an empty query with everything', () => {
    expect(names(search(''))).toEqual(names(categories));
    expect(names(search('   '))).toEqual(names(categories));
  });

  it('finds every name a word appears in', () => {
    expect(names(search('rome'))).toEqual([
      'Rise of Rome',
      'Fall of Rome',
      'Pax Romana',
    ]);
  });

  it('forgives a typo', () => {
    expect(names(search('corsiar'))).toEqual(['Corsair Seas']);
  });

  it('matches a word in the middle of a name', () => {
    expect(names(search('civilization'))).toEqual(['Cradle of Civilization']);
  });

  it('ignores the whitespace around a query', () => {
    expect(names(search('  corsair  '))).toEqual(['Corsair Seas']);
  });

  it('answers with nothing when no name is close', () => {
    expect(search('helicopter')).toEqual([]);
  });

  it('leaves the items it was given alone', () => {
    const items = [...categories];

    search('rome');

    expect(items).toEqual(categories);
  });
});
