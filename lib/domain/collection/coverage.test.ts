import { describe, expect, it } from 'vitest';
import type { TroopTypeCode } from '@/lib/data/schema.ts';
import {
  allyContingent,
  armyDetail,
  entries as troopEntries,
  troopOption,
} from '@/test/fixtures/army.ts';
import {
  buildArmyList,
  type ContingentGroupId,
  type TroopOptionId,
} from '../army/army-list';
import { type ArmySelection, emptySelection } from '../army/selection';
import { type CollectionEntry, type CollectionPin, coverage } from './coverage';

const armyList = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({
        min: 0,
        max: 12,
        description: 'Greek mercenary hoplites',
        troopEntries: troopEntries('SPR'),
      }),
      troopOption({
        min: 0,
        max: 12,
        description: 'Hoplites',
        troopEntries: troopEntries('HFT'),
      }),
      troopOption({
        min: 0,
        max: 12,
        description: 'Macedonian Phalanx',
        troopEntries: troopEntries('PIK', 'SPR'),
      }),
    ],
    allyOptions: [
      {
        allyEntries: [
          { allyArmyList: 'contingent-ally', name: 'Persian allies' },
        ],
        dateRange: null,
        note: null,
      },
    ],
    allyContingents: [
      allyContingent({
        id: 'contingent-ally',
        name: 'Persian allies',
        internalContingent: false,
        troopOptions: [
          troopOption({
            min: 0,
            max: 4,
            description: 'Spartan hoplites',
            troopEntries: troopEntries('HFT'),
          }),
        ],
      }),
    ],
  }),
);

const spear = 'main/0' as TroopOptionId;
const heavyFoot = 'main/1' as TroopOptionId;
const phalanx = 'main/2' as TroopOptionId;
const allied = 'contingent-ally/0' as TroopOptionId;
const allies = 'group/0' as ContingentGroupId;

const selection = (
  stands: ArmySelection['stands'],
  contingentGroups: readonly ContingentGroupId[] = [],
): ArmySelection => ({
  ...emptySelection({
    army: armyList.id,
    dataVersion: '2026-09-17.abcdef01',
    year: -2900,
  }),
  contingentGroups,
  stands,
});

const entry = (
  id: string,
  count: number,
  troopType: TroopTypeCode,
  overrides: Partial<CollectionEntry> = {},
): CollectionEntry => ({
  id,
  count,
  troopType,
  tags: [],
  status: 'painted',
  ...overrides,
});

const pin = (
  option: TroopOptionId,
  troopType: TroopTypeCode,
  entryId: string,
  count: number,
): CollectionPin => ({ option, troopType, entry: entryId, count });

const demand = (
  result: ReturnType<typeof coverage>,
  option: TroopOptionId,
  troopType: TroopTypeCode,
) => {
  const found = result.demands.find(
    (candidate) =>
      candidate.option === option && candidate.troopType === troopType,
  );
  if (!found) {
    throw new Error(`no ${troopType} demand on ${option}`);
  }
  return found;
};

describe('coverage', () => {
  it('asks for nothing when nothing is selected', () => {
    expect(coverage(selection({}), armyList, [], [])).toEqual({
      demands: [],
      stands: 0,
      covered: 0,
      toBuy: 0,
      toPaint: 0,
    });
  });

  it('puts every stand on the list to buy when the collection is empty', () => {
    const result = coverage(
      selection({ [spear]: { SPR: 4 }, [phalanx]: { PIK: 2, SPR: 1 } }),
      armyList,
      [],
      [],
    );

    expect(
      result.demands.map(({ option, troopType, toBuy }) => ({
        option,
        troopType,
        toBuy,
      })),
    ).toEqual([
      { option: spear, troopType: 'SPR', toBuy: 4 },
      { option: phalanx, troopType: 'PIK', toBuy: 2 },
      { option: phalanx, troopType: 'SPR', toBuy: 1 },
    ]);
    expect(result).toMatchObject({ stands: 7, covered: 0, toBuy: 7 });
  });

  it('only lets an entry fill a demand it fields as', () => {
    const result = coverage(
      selection({ [heavyFoot]: { HFT: 3 } }),
      armyList,
      [entry('spears', 6, 'SPR')],
      [],
    );

    expect(result).toMatchObject({ covered: 0, toBuy: 3 });
  });

  it('spends an entry at most count times within one list', () => {
    const result = coverage(
      selection({ [spear]: { SPR: 4 }, [phalanx]: { SPR: 4 } }),
      armyList,
      [entry('spears', 6, 'SPR')],
      [],
    );

    expect(result).toMatchObject({ stands: 8, covered: 6, toBuy: 2 });
  });

  it('prefers a match to a stand-in when both cover the same stands', () => {
    const result = coverage(
      selection({ [phalanx]: { PIK: 4 } }),
      armyList,
      [
        entry('swiss', 4, 'PIK', { tags: ['swiss'] }),
        entry('phalangites', 4, 'PIK', { tags: ['macedonian'] }),
      ],
      [],
    );

    expect(demand(result, phalanx, 'PIK').allocations).toEqual([
      {
        entry: 'phalangites',
        stands: 4,
        fit: 'match',
        pinned: false,
        status: 'painted',
      },
    ]);
  });

  it('prefers a match even when the stand-in is painted and the match is not', () => {
    const result = coverage(
      selection({ [phalanx]: { PIK: 4 } }),
      armyList,
      [
        entry('swiss', 4, 'PIK'),
        entry('phalangites', 4, 'PIK', {
          tags: ['phalanx'],
          status: 'unpainted',
        }),
      ],
      [],
    );

    expect(demand(result, phalanx, 'PIK')).toMatchObject({
      allocations: [{ entry: 'phalangites', fit: 'match' }],
      toPaint: 4,
    });
  });

  it('prefers painted stands, then those in progress, among equal fits', () => {
    const result = coverage(
      selection({ [spear]: { SPR: 5 } }),
      armyList,
      [
        entry('bare', 3, 'SPR', { status: 'unpainted' }),
        entry('started', 3, 'SPR', { status: 'inProgress' }),
        entry('done', 3, 'SPR'),
      ],
      [],
    );

    expect(
      demand(result, spear, 'SPR').allocations.map(({ entry, stands }) => ({
        entry,
        stands,
      })),
    ).toEqual([
      { entry: 'started', stands: 2 },
      { entry: 'done', stands: 3 },
    ]);
    expect(result).toMatchObject({ covered: 5, toBuy: 0, toPaint: 2 });
  });

  it('counts covered stands that are not painted yet as to paint', () => {
    const result = coverage(
      selection({ [spear]: { SPR: 6 } }),
      armyList,
      [
        entry('bare', 2, 'SPR', { status: 'unpainted' }),
        entry('started', 1, 'SPR', { status: 'inProgress' }),
      ],
      [],
    );

    expect(demand(result, spear, 'SPR')).toMatchObject({
      stands: 6,
      covered: 3,
      toBuy: 3,
      toPaint: 3,
    });
  });

  it('only asks for stands in contingents the list takes', () => {
    const stands = { [spear]: { SPR: 2 }, [allied]: { HFT: 4 } } as const;
    const collection = [entry('spartans', 4, 'HFT', { tags: ['spartan'] })];

    expect(coverage(selection(stands), armyList, collection, []).stands).toBe(
      2,
    );

    const withAllies = coverage(
      selection(stands, [allies]),
      armyList,
      collection,
      [],
    );
    expect(demand(withAllies, allied, 'HFT')).toMatchObject({
      contingent: 'contingent-ally',
      covered: 4,
      allocations: [{ entry: 'spartans', fit: 'match' }],
    });
  });

  describe('pins', () => {
    it('fixes a pin first even where the allocation would have chosen otherwise', () => {
      const result = coverage(
        selection({ [spear]: { SPR: 6 } }),
        armyList,
        [
          entry('spearmen', 6, 'SPR'),
          entry('levy', 6, 'SPR', { status: 'unpainted' }),
        ],
        [pin(spear, 'SPR', 'levy', 6)],
      );

      expect(demand(result, spear, 'SPR').allocations).toEqual([
        {
          entry: 'levy',
          stands: 6,
          fit: 'match',
          pinned: true,
          status: 'unpainted',
        },
      ]);
    });

    it('fills the rest of a pinned demand around the pin, as a match', () => {
      const result = coverage(
        selection({ [spear]: { SPR: 6 } }),
        armyList,
        [entry('militia', 3, 'SPR'), entry('levy', 8, 'SPR')],
        [pin(spear, 'SPR', 'levy', 2)],
      );

      expect(demand(result, spear, 'SPR').allocations).toEqual([
        {
          entry: 'levy',
          stands: 6,
          fit: 'match',
          pinned: true,
          status: 'painted',
        },
      ]);
    });

    it('holds a pin to what the entry has and the demand asks', () => {
      const result = coverage(
        selection({ [spear]: { SPR: 3 } }),
        armyList,
        [entry('levy', 2, 'SPR')],
        [pin(spear, 'SPR', 'levy', 10)],
      );

      expect(demand(result, spear, 'SPR')).toMatchObject({
        covered: 2,
        toBuy: 1,
        allocations: [{ entry: 'levy', stands: 2, pinned: true }],
      });
    });

    it('keeps a pin in view when the entry is spent before the pin reaches it', () => {
      const result = coverage(
        selection({ [spear]: { SPR: 2 }, [phalanx]: { SPR: 2 } }),
        armyList,
        [entry('levy', 2, 'SPR')],
        [pin(spear, 'SPR', 'levy', 2), pin(phalanx, 'SPR', 'levy', 2)],
      );

      expect(demand(result, phalanx, 'SPR')).toMatchObject({
        covered: 0,
        toBuy: 2,
        allocations: [{ entry: 'levy', stands: 0, pinned: true }],
      });
    });

    it('ignores a pin to an entry that no longer exists', () => {
      const result = coverage(
        selection({ [spear]: { SPR: 2 } }),
        armyList,
        [entry('levy', 2, 'SPR')],
        [pin(spear, 'SPR', 'deleted', 2)],
      );

      expect(demand(result, spear, 'SPR').allocations).toEqual([
        {
          entry: 'levy',
          stands: 2,
          fit: 'standIn',
          pinned: false,
          status: 'painted',
        },
      ]);
    });

    it('ignores a pin to an option the list does not ask for', () => {
      const result = coverage(
        selection({ [spear]: { SPR: 2 } }),
        armyList,
        [entry('levy', 2, 'SPR')],
        [
          pin('main/9' as TroopOptionId, 'SPR', 'levy', 2),
          pin(phalanx, 'SPR', 'levy', 2),
        ],
      );

      expect(demand(result, spear, 'SPR').covered).toBe(2);
    });

    it('ignores a pin to a troop type the entry no longer fields as', () => {
      const result = coverage(
        selection({ [heavyFoot]: { HFT: 2 } }),
        armyList,
        [entry('levy', 2, 'SPR')],
        [pin(heavyFoot, 'HFT', 'levy', 2)],
      );

      expect(result).toMatchObject({ covered: 0, toBuy: 2 });
    });
  });
});
