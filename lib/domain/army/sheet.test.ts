import { describe, expect, it } from 'vitest';
import { armyDetail, builderArmyDetail } from '@/test/fixtures/army.ts';
import {
  sampleBattleCardCosts,
  sampleCuration,
  sampleTroopTypes,
} from '@/test/sample.ts';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeNames,
} from '../troop-types.ts';
import { buildArmyList } from './army-list';
import {
  type ArmySelection,
  emptySelection,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withStands,
  withTroopBattleCard,
} from './selection';
import {
  armySheet,
  campOf,
  sheetStandColumns,
  sheetTroopHeadings,
} from './sheet';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);
const factors = troopTypeFactors(sampleTroopTypes);

const list = buildArmyList(armyDetail());

const spearmen = list.main.troopOptions[0];
const archers = list.main.troopOptions[1];
const knights = list.main.troopOptions[2];
const optionalGroup = list.contingentGroups[0];
const allyGroup = list.contingentGroups[1];

if (!spearmen || !archers || !knights || !optionalGroup || !allyGroup) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const lightFoot = optionalGroup.contingents[0].troopOptions[0];
const horseBow = allyGroup.contingents[1]?.troopOptions[0];

if (!lightFoot || !horseBow) {
  throw new Error(
    'the fixture army no longer has the contingents the tests need',
  );
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

const sheetOf = (selection: ArmySelection, listName = 'My list') =>
  armySheet({
    listName,
    armyList: list,
    selection,
    costs,
    names,
    factors,
    movement: sampleCuration.movement,
    cardNames: { FC: 'Fortified Camp', HL: 'Hold the Line' },
  });

describe('an empty list', () => {
  it('carries no contingents and no points', () => {
    const sheet = sheetOf(empty);
    expect(sheet.contingents).toEqual([]);
    expect(sheet.battleCards).toEqual([]);
    expect(sheet.totals).toEqual({
      stands: 0,
      standPoints: 0,
      allyStandPoints: 0,
      battleCardPoints: 0,
      total: 0,
    });
  });

  it('still names the list and the army it was built from', () => {
    const sheet = sheetOf(empty, 'Kish at dawn');
    expect(sheet.listName).toBe('Kish at dawn');
    expect(sheet.armyId).toBe('army-1');
    expect(sheet.armyName).toBe('Fixture Army');
    expect(sheet.extendedName).toBe('Fixture Army 3000 to 2800 BC');
    expect(sheet.key).toBe('1a');
  });

  it('carries the year the list is built at and the list span', () => {
    const sheet = sheetOf(empty);
    expect(sheet.year).toBe(-2900);
    expect(sheet.dateRange).toEqual({ startDate: -3000, endDate: -2800 });
  });

  it('carries the ratings and topographies the army list states', () => {
    const sheet = sheetOf(empty);
    expect(sheet.invasionRatings).toEqual([{ value: 2, note: null }]);
    expect(sheet.maneuverRatings).toEqual([{ value: 1, note: null }]);
    expect(sheet.homeTopographies).toEqual([{ values: ['Arable'], note: '' }]);
  });
});

describe('stands', () => {
  it('groups them under the contingent and the troop option they came from', () => {
    const sheet = sheetOf(withStands(empty, spearmen, 'SPR', 3));
    expect(sheet.contingents).toHaveLength(1);
    const [contingent] = sheet.contingents;
    expect(contingent?.kind).toBe('main');
    expect(contingent?.name).toBe('Fixture Army');
    expect(contingent?.stands).toBe(3);
    expect(contingent?.options).toHaveLength(1);
    expect(contingent?.options[0]?.id).toBe(spearmen.id);
  });

  it('leaves out a troop option nothing was taken from', () => {
    const sheet = sheetOf(withStands(empty, spearmen, 'SPR', 1));
    expect(sheet.contingents[0]?.options.map(({ id }) => id)).not.toContain(
      archers.id,
    );
  });

  it('prices each line by its troop type and totals the option', () => {
    const sheet = sheetOf(
      withStands(withStands(empty, archers, 'ARC', 2), archers, 'BLV', 1),
    );
    const option = sheet.contingents[0]?.options[0];
    expect(
      option?.lines.map(({ troopType, stands, points }) => ({
        troopType,
        stands,
        points,
      })),
    ).toEqual([
      { troopType: 'ARC', stands: 2, points: 2 * costs.troopTypes.ARC },
      { troopType: 'BLV', stands: 1, points: costs.troopTypes.BLV },
    ]);
    expect(option?.points).toBe(
      2 * costs.troopTypes.ARC + costs.troopTypes.BLV,
    );
    expect(option?.stands).toBe(3);
  });

  it('names each troop type and carries its combat factors', () => {
    const sheet = sheetOf(withStands(empty, spearmen, 'SPR', 1));
    const line = sheet.contingents[0]?.options[0]?.lines[0];
    expect(line?.name).toBe(names.SPR);
    expect(line?.factors).toEqual(factors.SPR);
    expect(line?.pointsPerStand).toBe(costs.troopTypes.SPR);
  });

  it('carries the movement distance of each troop type', () => {
    const sheet = sheetOf(
      withStands(withStands(empty, spearmen, 'SPR', 1), knights, 'KNT', 1),
    );
    const lines = sheet.contingents[0]?.options.flatMap(({ lines }) => lines);
    expect(
      lines?.map(({ troopType, movement }) => [troopType, movement]),
    ).toEqual([
      ['SPR', 3],
      ['KNT', 5],
    ]);
  });

  it('carries the battle line standing of the troop option', () => {
    const sheet = sheetOf(
      withStands(withStands(empty, spearmen, 'SPR', 1), knights, 'KNT', 1),
    );
    const options = sheet.contingents[0]?.options ?? [];
    expect(options.map(({ battleLine }) => battleLine)).toEqual([
      'all',
      'half',
    ]);
  });

  it('carries the note the army list prints beside an option', () => {
    const sheet = sheetOf(withStands(empty, archers, 'ARC', 1));
    expect(sheet.contingents[0]?.options[0]?.note).toBe('only Kish');
  });
});

describe('the general', () => {
  it('is nobody until one is chosen', () => {
    const sheet = sheetOf(withStands(empty, spearmen, 'SPR', 2));
    expect(sheet.general).toBeNull();
    expect(sheet.contingents[0]?.options[0]?.lines[0]?.general).toBe(false);
  });

  it('names the stand carrying it and marks its line', () => {
    const selection = withGeneral(withStands(empty, spearmen, 'SPR', 2), {
      option: spearmen.id,
      troopType: 'SPR',
    });
    const sheet = sheetOf(selection);
    expect(sheet.general).toEqual({
      troopType: 'SPR',
      name: names.SPR,
      contingent: 'Fixture Army',
      option: spearmen.description,
    });
    expect(sheet.contingents[0]?.options[0]?.lines[0]?.general).toBe(true);
  });

  it('marks only the line the general stands in', () => {
    const selection = withGeneral(
      withStands(withStands(empty, spearmen, 'SPR', 1), knights, 'KNT', 1),
      { option: knights.id, troopType: 'KNT' },
    );
    const sheet = sheetOf(selection);
    const marked = (sheet.contingents[0]?.options ?? []).flatMap(({ lines }) =>
      lines.filter(({ general }) => general).map(({ troopType }) => troopType),
    );
    expect(marked).toEqual(['KNT']);
  });
});

describe('contingents', () => {
  it('carries an optional contingent under its own heading once taken', () => {
    const selection = withStands(
      withContingentGroup(withStands(empty, spearmen, 'SPR', 2), optionalGroup),
      lightFoot,
      'LFT',
      1,
    );
    const sheet = sheetOf(selection);
    expect(sheet.contingents.map(({ kind, name }) => ({ kind, name }))).toEqual(
      [
        { kind: 'main', name: 'Fixture Army' },
        { kind: 'optional', name: 'Fixture Optional Contingent' },
      ],
    );
  });

  it('counts allied stands separately in the totals', () => {
    const selection = withStands(
      withContingentGroup(withStands(empty, spearmen, 'SPR', 2), allyGroup),
      horseBow,
      'HBW',
      2,
    );
    const sheet = sheetOf(selection);
    expect(sheet.totals.allyStandPoints).toBe(2 * costs.troopTypes.HBW);
    expect(sheet.totals.standPoints).toBe(
      2 * costs.troopTypes.SPR + 2 * costs.troopTypes.HBW,
    );
    expect(sheet.totals.stands).toBe(4);
  });
});

describe('battle cards', () => {
  it('names a card the army bought and charges it', () => {
    const sheet = sheetOf(withArmyBattleCard(empty, 'FC', 1));
    expect(sheet.battleCards).toEqual([
      {
        code: 'FC',
        name: 'Fortified Camp',
        purchases: 1,
        stands: 0,
        points: 1,
        attachedTo: [],
      },
    ]);
    expect(sheet.totals.battleCardPoints).toBe(1);
  });

  it('says which troop option a card attaches to', () => {
    const selection = withTroopBattleCard(
      withStands(empty, spearmen, 'SPR', 2),
      spearmen,
      'HL',
      2,
    );
    const sheet = sheetOf(selection);
    expect(sheet.battleCards[0]?.attachedTo).toEqual([spearmen.description]);
    expect(sheet.battleCards[0]?.stands).toBe(2);
  });

  it('falls back to the curated name for a card no army list prints', () => {
    const sheet = armySheet({
      listName: 'My list',
      armyList: list,
      selection: withArmyBattleCard(empty, 'FC', 1),
      costs,
      names,
      factors,
      movement: sampleCuration.movement,
      cardNames: {},
    });
    expect(sheet.battleCards[0]?.name).toBe('Fortified Camp');
  });
});

describe('the camp', () => {
  it('takes no camp card until the army buys one', () => {
    expect(campOf(empty)).toEqual([]);
    expect(sheetOf(empty).camp).toEqual([]);
  });

  it('is fortified when the army buys the card', () => {
    expect(campOf(withArmyBattleCard(empty, 'FC', 1))).toEqual(['FC']);
  });

  it('is none when the army goes without', () => {
    expect(campOf(withArmyBattleCard(empty, 'NC', 1))).toEqual(['NC']);
  });

  it('names every camp card the army took, in a fixed order', () => {
    const selection = withArmyBattleCard(
      withArmyBattleCard(empty, 'PT', 1),
      'FC',
      1,
    );
    expect(campOf(selection)).toEqual(['FC', 'PT']);
  });

  it('ignores a card that has nothing to do with the camp', () => {
    expect(campOf(withArmyBattleCard(empty, 'HL', 1))).toEqual([]);
  });
});

describe('the sub-faction', () => {
  it('is absent from a list that offers none', () => {
    expect(sheetOf(empty).subFaction).toBeNull();
  });

  it('is unanswered until one is chosen', () => {
    const withVariants = buildArmyList(builderArmyDetail());
    const sheet = armySheet({
      listName: 'My list',
      armyList: withVariants,
      selection: emptySelection({
        army: withVariants.id,
        dataVersion: '2026-09-17.abcdef01',
        year: -2900,
      }),
      costs,
      names,
      factors,
      movement: sampleCuration.movement,
      cardNames: {},
    });
    expect(sheet.subFaction?.label).toBe(withVariants.subFactions?.label);
    expect(sheet.subFaction?.name).toBeNull();
  });

  it('names the variant the list was built for', () => {
    const withVariants = buildArmyList(builderArmyDetail());
    const variant = withVariants.subFactions?.variants[0];
    if (!variant) {
      throw new Error('the builder fixture no longer offers sub-factions');
    }
    const sheet = armySheet({
      listName: 'My list',
      armyList: withVariants,
      selection: {
        ...emptySelection({
          army: withVariants.id,
          dataVersion: '2026-09-17.abcdef01',
          year: -2900,
        }),
        variant: variant.id,
      },
      costs,
      names,
      factors,
      movement: sampleCuration.movement,
      cardNames: {},
    });
    expect(sheet.subFaction?.name).toBe(variant.name);
  });
});

describe('the totals', () => {
  it('add the stands and the battle cards into one number', () => {
    const selection = withArmyBattleCard(
      withStands(empty, spearmen, 'SPR', 3),
      'FC',
      1,
    );
    const sheet = sheetOf(selection);
    expect(sheet.totals.standPoints).toBe(3 * costs.troopTypes.SPR);
    expect(sheet.totals.battleCardPoints).toBe(1);
    expect(sheet.totals.total).toBe(3 * costs.troopTypes.SPR + 1);
    expect(sheet.totals.stands).toBe(3);
  });
});

describe('the troop columns', () => {
  it('lead with the troop type, then its points, its movement and its factors', () => {
    expect(sheetTroopHeadings).toEqual([
      'troopType',
      'pointsPerStand',
      'total',
      'move',
      'vFoot',
      'vMounted',
      'shoot',
      'shotAt',
    ]);
  });

  it('read each figure off the stand line', () => {
    const sheet = sheetOf(withStands(empty, spearmen, 'SPR', 2));
    const line = sheet.contingents[0]?.options[0]?.lines[0];
    if (!line) {
      throw new Error('the sheet carries no line for the spearmen');
    }
    expect(sheetStandColumns.map(({ value }) => value(line))).toEqual([
      costs.troopTypes.SPR,
      2 * costs.troopTypes.SPR,
      3,
      factors.SPR.closeCombat.vsFoot,
      factors.SPR.closeCombat.vsMounted,
      factors.SPR.rangedCombat.shooting,
      factors.SPR.rangedCombat.shotAt,
    ]);
  });
});
