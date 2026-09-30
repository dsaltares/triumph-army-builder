import { describe, expect, it } from 'vitest';
import type { TroopOptionId } from '../army/army-list';
import { type ArmySelection, emptySelection } from '../army/selection';
import type { CollectionPin } from './coverage';
import { stalePins } from './pins';

const spear = 'main/0' as TroopOptionId;
const heavyFoot = 'main/1' as TroopOptionId;

const selection = (stands: ArmySelection['stands']): ArmySelection => ({
  ...emptySelection({
    army: 'army-1',
    dataVersion: '2026-09-17.abcdef01',
    year: -2900,
  }),
  stands,
});

const levyOnSpear: CollectionPin = {
  option: spear,
  troopType: 'SPR',
  entry: 'levy',
  count: 4,
};

const levy = { id: 'levy', troopType: 'SPR' } as const;

describe('stalePins', () => {
  it('keeps a pin to a troop the list takes, with an entry that fields as it', () => {
    expect(
      stalePins(selection({ [spear]: { SPR: 2 } }), [levyOnSpear], [levy]),
    ).toEqual([]);
  });

  it('finds a pin to a troop type the list no longer takes on that option', () => {
    expect(
      stalePins(selection({ [spear]: { HFT: 2 } }), [levyOnSpear], [levy]),
    ).toEqual([levyOnSpear]);
  });

  it('finds a pin to an option the list no longer takes', () => {
    expect(
      stalePins(selection({ [heavyFoot]: { HFT: 2 } }), [levyOnSpear], [levy]),
    ).toEqual([levyOnSpear]);
  });

  it('finds a pin to an entry that has gone', () => {
    expect(
      stalePins(selection({ [spear]: { SPR: 2 } }), [levyOnSpear], []),
    ).toEqual([levyOnSpear]);
  });

  it('finds a pin to an entry that no longer fields as that troop type', () => {
    expect(
      stalePins(
        selection({ [spear]: { SPR: 2 } }),
        [levyOnSpear],
        [{ id: 'levy', troopType: 'HFT' }],
      ),
    ).toEqual([levyOnSpear]);
  });
});
