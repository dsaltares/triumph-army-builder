import { describe, expect, it } from 'vitest';
import type { TroopTypeCode } from '../../data/schema.ts';
import {
  activeCollectionFilterCount,
  collectionTags,
  collectionTotals,
  collectionTroopTypes,
  filterCollection,
  nextCollectionSort,
  noCollectionFilters,
  sortCollection,
} from './collection-index.ts';
import type { CollectionStatus } from './entry.ts';

const entry = (
  name: string,
  count: number,
  status: CollectionStatus,
  troopType: TroopTypeCode,
  tags: string[] = [],
) => ({ name, count, status, troopType, tags });

const hoplites = entry('Hoplites', 8, 'painted', 'HFT', ['theban']);
const peltasts = entry('Peltasts', 4, 'inProgress', 'LFT');
const cavalry = entry('Thessalians', 3, 'unpainted', 'CAT', [
  'thessalian',
  'cavalry',
]);

const collection = [hoplites, peltasts, cavalry];

const hero = (name: string, count: number, status: CollectionStatus) => ({
  kind: 'hero' as const,
  name,
  count,
  status,
  tags: ['theban'],
});

const epaminondas = hero('Epaminondas', 1, 'painted');

const pelopidas = hero('Pelopidas', 2, 'unpainted');

const withHeroes = [epaminondas, hoplites, pelopidas, peltasts];

const names = (entries: readonly { name: string }[]) =>
  entries.map(({ name }) => name);

describe('filterCollection', () => {
  it('keeps everything with no filters on', () => {
    expect(filterCollection(collection, noCollectionFilters)).toEqual(
      collection,
    );
  });

  it('keeps an entry whose name, tags or troop type hold every search term', () => {
    const searched = (search: string) =>
      names(filterCollection(collection, { ...noCollectionFilters, search }));

    expect(searched('HOP')).toEqual(['Hoplites']);
    expect(searched('thébán hop')).toEqual(['Hoplites']);
    expect(searched('lft')).toEqual(['Peltasts']);
    expect(searched('theban peltasts')).toEqual([]);
  });

  it('keeps an entry that fields as one of the chosen troop types', () => {
    expect(
      names(
        filterCollection(collection, {
          ...noCollectionFilters,
          troopTypes: ['HFT', 'CAT'],
          statuses: [],
        }),
      ),
    ).toEqual(['Hoplites', 'Thessalians']);
  });

  it('keeps an entry in any one of the chosen statuses', () => {
    expect(
      names(
        filterCollection(collection, {
          ...noCollectionFilters,
          troopTypes: [],
          statuses: ['unpainted', 'inProgress'],
        }),
      ),
    ).toEqual(['Peltasts', 'Thessalians']);
  });

  it('asks an entry to pass both a troop type and a status', () => {
    expect(
      names(
        filterCollection(collection, {
          ...noCollectionFilters,
          troopTypes: ['HFT', 'LFT'],
          statuses: ['painted'],
        }),
      ),
    ).toEqual(['Hoplites']);
  });

  it('keeps an entry carrying any one of the chosen tags', () => {
    expect(
      names(
        filterCollection(collection, {
          ...noCollectionFilters,
          tags: ['theban', 'cavalry'],
        }),
      ),
    ).toEqual(['Hoplites', 'Thessalians']);
  });
});

describe('filterCollection with heroes', () => {
  it('keeps the entries of any one of the chosen kinds', () => {
    const ofKinds = (kinds: ('stands' | 'hero')[]) =>
      names(filterCollection(withHeroes, { ...noCollectionFilters, kinds }));

    expect(ofKinds(['hero'])).toEqual(['Epaminondas', 'Pelopidas']);
    expect(ofKinds(['stands'])).toEqual(['Hoplites', 'Peltasts']);
    expect(ofKinds([])).toEqual(names(withHeroes));
  });

  it('leaves heroes out once a troop type is chosen', () => {
    expect(
      names(
        filterCollection(withHeroes, {
          ...noCollectionFilters,
          troopTypes: ['HFT'],
        }),
      ),
    ).toEqual(['Hoplites']);
  });

  it('searches a hero by its name and tags', () => {
    expect(
      names(
        filterCollection(withHeroes, {
          ...noCollectionFilters,
          search: 'theban',
        }),
      ),
    ).toEqual(['Epaminondas', 'Hoplites', 'Pelopidas']);
  });

  it('offers no troop type for a hero', () => {
    expect(collectionTroopTypes(withHeroes)).toEqual(['HFT', 'LFT']);
  });

  it('keeps the entries of any one of the chosen games, Triumph! when none is said', () => {
    const wargs = {
      ...entry('Wargs', 4, 'painted', 'JCV'),
      games: ['fantasy' as const],
    };
    const ofGames = (games: ('triumph' | 'fantasy')[]) =>
      names(
        filterCollection([hoplites, wargs], { ...noCollectionFilters, games }),
      );

    expect(ofGames(['fantasy'])).toEqual(['Wargs']);
    expect(ofGames(['triumph'])).toEqual(['Hoplites']);
    expect(ofGames(['triumph', 'fantasy'])).toEqual(['Hoplites', 'Wargs']);
  });

  it('counts a chosen kind as a filter turned on', () => {
    expect(
      activeCollectionFilterCount({ ...noCollectionFilters, kinds: ['hero'] }),
    ).toBe(1);
  });
});

describe('activeCollectionFilterCount', () => {
  it('counts every chip and tag turned on, and not the search', () => {
    expect(activeCollectionFilterCount(noCollectionFilters)).toBe(0);
    expect(
      activeCollectionFilterCount({
        troopTypes: ['HFT', 'SPR'],
        statuses: ['painted'],
        tags: ['theban'],
      }),
    ).toBe(4);
  });
});

describe('collectionTags', () => {
  it('lists each tag the collection carries once, in alphabetical order, keeping the chosen ones', () => {
    expect(collectionTags(collection, ['argive'])).toEqual([
      'argive',
      'cavalry',
      'theban',
      'thessalian',
    ]);
  });
});

describe('collectionTroopTypes', () => {
  it('lists each troop type the collection fields once, in code order', () => {
    expect(
      collectionTroopTypes([
        ...collection,
        entry('Spearmen', 2, 'painted', 'SPR'),
        entry('More hoplites', 2, 'painted', 'HFT'),
      ]),
    ).toEqual(['CAT', 'HFT', 'LFT', 'SPR']);
  });

  it('keeps a chosen troop type the collection no longer fields, so it can be turned off', () => {
    expect(collectionTroopTypes([peltasts], ['PIK'])).toEqual(['LFT', 'PIK']);
  });

  it('lists none for an empty collection', () => {
    expect(collectionTroopTypes([])).toEqual([]);
  });
});

describe('collectionTotals', () => {
  it('counts stands, and splits them into painted and still to paint', () => {
    expect(collectionTotals(collection)).toEqual({
      owned: 15,
      painted: 8,
      toPaint: 7,
    });
  });

  it('counts a hero as stands, painted or not', () => {
    expect(collectionTotals(withHeroes)).toEqual({
      owned: 15,
      painted: 9,
      toPaint: 6,
    });
  });

  it('is all zeroes for an empty collection', () => {
    expect(collectionTotals([])).toEqual({ owned: 0, painted: 0, toPaint: 0 });
  });
});

describe('sortCollection', () => {
  it('keeps the order it was given when nothing is sorted', () => {
    expect(names(sortCollection(collection, null))).toEqual([
      'Hoplites',
      'Peltasts',
      'Thessalians',
    ]);
  });

  it('sorts by name, stands, troop type or status, either way', () => {
    const sorted = (
      column: 'name' | 'stands' | 'troopType' | 'status',
      direction: 'asc' | 'desc',
    ) => names(sortCollection(collection, { column, direction }));

    expect(sorted('name', 'desc')).toEqual([
      'Thessalians',
      'Peltasts',
      'Hoplites',
    ]);
    expect(sorted('stands', 'asc')).toEqual([
      'Thessalians',
      'Peltasts',
      'Hoplites',
    ]);
    expect(sorted('troopType', 'asc')).toEqual([
      'Thessalians',
      'Hoplites',
      'Peltasts',
    ]);
    expect(sorted('status', 'desc')).toEqual([
      'Hoplites',
      'Peltasts',
      'Thessalians',
    ]);
  });

  it('puts heroes after the stands when nothing is sorted', () => {
    expect(names(sortCollection(withHeroes, null))).toEqual([
      'Hoplites',
      'Peltasts',
      'Epaminondas',
      'Pelopidas',
    ]);
  });

  it('puts heroes after every troop type when sorted by it', () => {
    expect(
      names(
        sortCollection(withHeroes, { column: 'troopType', direction: 'asc' }),
      ),
    ).toEqual(['Hoplites', 'Peltasts', 'Epaminondas', 'Pelopidas']);
  });

  it('keeps the given order between entries that tie', () => {
    const twin = entry('Hoplites', 8, 'unpainted', 'SPR');

    expect(
      sortCollection([twin, hoplites], { column: 'name', direction: 'asc' }),
    ).toEqual([twin, hoplites]);
  });
});

describe('nextCollectionSort', () => {
  it('starts a new column in its natural direction, most stands first', () => {
    expect(nextCollectionSort(null, 'name')).toEqual({
      column: 'name',
      direction: 'asc',
    });
    expect(
      nextCollectionSort({ column: 'name', direction: 'asc' }, 'stands'),
    ).toEqual({ column: 'stands', direction: 'desc' });
  });

  it('flips the direction of the column already sorted', () => {
    expect(
      nextCollectionSort({ column: 'stands', direction: 'desc' }, 'stands'),
    ).toEqual({ column: 'stands', direction: 'asc' });
    expect(
      nextCollectionSort({ column: 'status', direction: 'desc' }, 'status'),
    ).toEqual({ column: 'status', direction: 'asc' });
  });
});
