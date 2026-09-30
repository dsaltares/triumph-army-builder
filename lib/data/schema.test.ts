import { describe, expect, it } from 'vitest';
import {
  allyArmyListSchema,
  armyListSchema,
  battleCardSchema,
  enemyArmyListsSchema,
  troopTypeSchema,
} from '@/lib/data/schema.ts';
import {
  rawAllyArmyList,
  rawArmyList,
  rawBattleCard,
  rawTroopType,
} from '@/test/fixtures/meshwesh.ts';

const parseArmyList = (overrides: Record<string, unknown> = {}) =>
  armyListSchema.parse(rawArmyList(overrides));

const armyListIssues = (overrides: Record<string, unknown>) => {
  const result = armyListSchema.safeParse(rawArmyList(overrides));
  return result.success ? [] : result.error.issues;
};

describe('armyListSchema', () => {
  it('drops every _id', () => {
    const armyList = parseArmyList();

    expect(JSON.stringify(armyList)).not.toContain('_id');
    expect(armyList.troopOptions[0]?.troopEntries[0]).toEqual({
      troopTypeCode: 'SPR',
      dismountTypeCode: null,
      note: null,
    });
  });

  it('normalises home topography whitespace', () => {
    expect(parseArmyList().homeTopographies[0]?.values).toEqual([
      'Arable',
      'Hilly',
    ]);
  });

  it('rejects a topography the rules do not have', () => {
    const issues = armyListIssues({
      homeTopographies: [{ _id: 'h1', values: ['Jungle'], note: '' }],
    });

    expect(issues[0]?.path).toEqual(['homeTopographies', 0, 'values', 0]);
  });

  it('trims free text', () => {
    expect(parseArmyList().name).toBe('Goblin Warrens');
  });

  it('defaults absent battle card bounds to null', () => {
    expect(parseArmyList().battleCardEntries[0]).toEqual({
      battleCardCode: 'FC',
      min: null,
      max: null,
      note: null,
    });
  });

  it('keeps list ids that upstream fractions to insert a list between two others', () => {
    expect(parseArmyList({ listId: 42.5, sortId: 42.5 }).listId).toBe(42.5);
  });

  it('fails on an unknown field, so upstream shape drift stops the build', () => {
    const issues = armyListIssues({ pointsCap: 48 });

    expect(issues[0]?.code).toBe('unrecognized_keys');
  });

  it('fails on an unknown troop type code', () => {
    const issues = armyListIssues({
      troopEntriesForGeneral: [
        {
          _id: 'g1',
          troopEntries: [
            {
              _id: 'e1',
              troopTypeCode: 'XXX',
              dismountTypeCode: null,
              note: null,
            },
          ],
        },
      ],
    });

    expect(issues[0]?.path).toEqual([
      'troopEntriesForGeneral',
      0,
      'troopEntries',
      0,
      'troopTypeCode',
    ]);
  });

  it('fails on an unknown battle card code', () => {
    const issues = armyListIssues({
      battleCardEntries: [{ _id: 'b1', battleCardCode: 'ZZ', note: null }],
    });

    expect(issues[0]?.path).toEqual(['battleCardEntries', 0, 'battleCardCode']);
  });
});

describe('allyArmyListSchema', () => {
  it('reads a standalone contingent with no parent army list', () => {
    const { armyListId, ...rest } = rawAllyArmyList();

    expect(allyArmyListSchema.parse(rest).armyListId).toBeNull();
  });
});

describe('battleCardSchema', () => {
  it('keeps mdText and drops htmlText', () => {
    const battleCard = battleCardSchema.parse(rawBattleCard());

    expect(battleCard.mdText).toContain('#### Cost');
    expect(battleCard).not.toHaveProperty('htmlText');
  });
});

describe('troopTypeSchema', () => {
  it('parses cost and combat factors', () => {
    const troopType = troopTypeSchema.parse(rawTroopType());

    expect(troopType.cost).toBe(4);
    expect(troopType.combatFactors.rangedCombat.shotAt).toBe(3);
  });
});

describe('enemyArmyListsSchema', () => {
  it('parses a map of army list id to enemy ids', () => {
    expect(enemyArmyListsSchema.parse({ a1: ['a2'] })).toEqual({ a1: ['a2'] });
  });

  it('fails when an enemy id is not a string', () => {
    expect(enemyArmyListsSchema.safeParse({ a1: [2] }).success).toBe(false);
  });
});
