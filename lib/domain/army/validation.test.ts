import { createTranslator } from 'next-intl';
import { beforeAll, describe, expect, it } from 'vitest';
import { describeFinding } from '@/lib/findings.ts';
import { messagesFor } from '@/lib/i18n/messages.ts';
import {
  allyContingent,
  armyDetail,
  battleCardEntry,
  builderArmyDetail,
  entries,
  troopOption,
} from '@/test/fixtures/army.ts';
import {
  sampleArmyLists,
  sampleBattleCardCosts,
  sampleSnapshotBattleCards,
  sampleTroopTypes,
} from '@/test/sample.ts';
import { troopTypeCosts, troopTypeNames } from '../troop-types.ts';
import {
  type ArmyList,
  buildArmyList,
  type ContingentGroupId,
  type TroopOptionId,
} from './army-list';
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
  battleCardPurchaseLimits,
  type Finding,
  isLegal,
  type ValidationRules,
  validateArmy,
} from './validation';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);
const dataVersion = '2026-09-17.abcdef01';

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

const emptyIn = (year: number) =>
  emptySelection({ army: list.id, dataVersion, year });

const empty = emptyIn(-2900);

const filled = withStands(
  withStands(withStands(empty, spearmen, 'SPR', 6), archers, 'ARC', 4),
  knights,
  'KNT',
  2,
);

const legal = withGeneral(filled, {
  option: spearmen.id,
  troopType: 'SPR',
});

const translate = createTranslator({
  locale: 'en',
  messages: messagesFor('en'),
  namespace: 'findings',
});

const described = (findings: readonly Finding[]) =>
  findings.map(({ code, severity, target }, index) => ({
    code,
    severity,
    message: describeFinding(findings[index] as Finding, translate),
    target,
  }));

const rawFindingsFor = (
  selection: ArmySelection,
  armyList: ArmyList = list,
  rules?: ValidationRules,
) =>
  rules
    ? validateArmy(armyList, selection, costs, names, rules)
    : validateArmy(armyList, selection, costs, names);

const findingsFor = (...args: Parameters<typeof rawFindingsFor>) =>
  described(rawFindingsFor(...args));

const codesFor = (...args: Parameters<typeof findingsFor>) =>
  findingsFor(...args).map(({ code }) => code);

const only = <T extends { code: string }>(
  findings: readonly T[],
  code: string,
) => findings.filter((finding) => finding.code === code);

describe('a legal army', () => {
  it('has nothing to report', () => {
    expect(findingsFor(legal)).toEqual([]);
    expect(isLegal(rawFindingsFor(legal))).toBe(true);
  });

  it('is illegal as soon as a rule is broken', () => {
    expect(isLegal(rawFindingsFor(filled))).toBe(false);
  });
});

describe('the points cap', () => {
  it('reports an army over the cap', () => {
    const selection = withStands(
      withContingentGroup(legal, optionalGroup),
      lightFoot,
      'LFT',
      2,
    );

    expect(findingsFor(selection)).toEqual([
      {
        code: 'overPointsCap',
        severity: 'error',
        message: '54 points selected, 6 over the 48 point cap',
        target: { kind: 'army' },
      },
    ]);
  });

  it('warns about points left unspent', () => {
    const selection = withStands(legal, knights, 'KNT', 1);

    expect(findingsFor(selection)).toEqual([
      {
        code: 'underPointsCap',
        severity: 'warning',
        message: '44 points selected, 4 of 48 unspent',
        target: { kind: 'army' },
      },
    ]);
  });

  it('takes the cap as a rule rather than a constant', () => {
    expect(codesFor(legal, list, { pointsCap: 44 })).toEqual(['overPointsCap']);
    expect(findingsFor(legal, list, { pointsCap: 48 })).toEqual([]);
  });
});

describe('gating', () => {
  it('reports a year the army was never around for', () => {
    const selection = { ...legal, year: -2000 };

    expect(codesFor(selection)).toContain('yearOutsideArmyDateRange');
  });

  it('warns while the sub-faction question is unanswered', () => {
    const gated = buildArmyList(
      armyDetail({ subFactions: builderArmyDetail().subFactions }),
    );

    expect(codesFor(legal, gated)).toContain('subFactionNotChosen');
    expect(codesFor({ ...legal, variant: 'kish' }, gated)).not.toContain(
      'subFactionNotChosen',
    );
  });

  it('warns about a variant the army does not offer', () => {
    const gated = buildArmyList(
      armyDetail({ subFactions: builderArmyDetail().subFactions }),
    );

    expect(codesFor({ ...legal, variant: 'umma' }, gated)).not.toContain(
      'unknownSubFaction',
    );
    expect(codesFor({ ...legal, variant: 'atlantis' }, gated)).toContain(
      'unknownSubFaction',
    );
  });
});

describe('required troops', () => {
  it('reports an option below its minimum', () => {
    const selection = withStands(legal, spearmen, 'SPR', 1);

    expect(only(findingsFor(selection), 'troopOptionBelowMin')).toEqual([
      {
        code: 'troopOptionBelowMin',
        severity: 'error',
        message: 'Spear needs at least 2 stands, 1 stand selected',
        target: { kind: 'troopOption', option: spearmen.id },
      },
    ]);
  });

  it('reports an option above its maximum', () => {
    const selection = withStands(legal, spearmen, 'SPR', 7);

    expect(only(findingsFor(selection), 'troopOptionAboveMax')).toEqual([
      {
        code: 'troopOptionAboveMax',
        severity: 'error',
        message: 'Spear allows at most 6 stands, 7 stands selected',
        target: { kind: 'troopOption', option: spearmen.id },
      },
    ]);
  });

  it('counts a multi-type entry against one shared maximum', () => {
    const mixed = withStands(
      withStands(legal, archers, 'ARC', 3),
      archers,
      'BLV',
      2,
    );

    expect(only(findingsFor(mixed), 'troopOptionAboveMax')).toEqual([
      {
        code: 'troopOptionAboveMax',
        severity: 'error',
        message:
          'Archers or Bow Levy allows at most 4 stands, 5 stands selected',
        target: { kind: 'troopOption', option: archers.id },
      },
    ]);
  });

  it('reports an option annotated all that has been mixed', () => {
    const singleType = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption({
            min: 0,
            max: 6,
            troopEntries: [
              { troopTypeCode: 'PIK', dismountTypeCode: null, note: 'all' },
              { troopTypeCode: 'LSP', dismountTypeCode: null, note: 'all' },
            ],
          }),
        ],
        troopEntriesForGeneral: [{ troopEntries: entries('PIK') }],
        allyOptions: [],
        allyContingents: [],
      }),
    );
    const pikes = singleType.main.troopOptions[0];
    if (!pikes) {
      throw new Error('the single type army has no troop option');
    }
    const oneType = withGeneral(withStands(emptyIn(-2900), pikes, 'PIK', 4), {
      option: pikes.id,
      troopType: 'PIK',
    });

    expect(codesFor(oneType, singleType)).not.toContain(
      'troopOptionMixedTypes',
    );
    expect(
      only(
        findingsFor(withStands(oneType, pikes, 'LSP', 2), singleType),
        'troopOptionMixedTypes',
      ),
    ).toEqual([
      {
        code: 'troopOptionMixedTypes',
        severity: 'error',
        message:
          'Pikes or Light Spear must be one troop type throughout, Pikes and Light Spear selected',
        target: { kind: 'troopOption', option: pikes.id },
      },
    ]);
  });
});

describe('contingents', () => {
  it('applies a contingent minimum only once the contingent is taken', () => {
    const taken = withContingentGroup(legal, optionalGroup);

    expect(codesFor(legal)).not.toContain('troopOptionBelowMin');
    expect(only(findingsFor(taken), 'troopOptionBelowMin')).toEqual([
      {
        code: 'troopOptionBelowMin',
        severity: 'error',
        message: 'Light Foot needs at least 1 stand, 0 stands selected',
        target: { kind: 'troopOption', option: lightFoot.id },
      },
    ]);
  });

  it('lets an army take any number of optional contingents', () => {
    const optionalOnly = buildArmyList(
      armyDetail({
        allyOptions: [
          {
            allyEntries: [{ allyArmyList: 'first', name: 'First friends' }],
            dateRange: null,
            note: null,
          },
          {
            allyEntries: [{ allyArmyList: 'second', name: 'Second friends' }],
            dateRange: null,
            note: null,
          },
        ],
        allyContingents: [
          allyContingent({
            id: 'first',
            troopOptions: [
              troopOption({ min: 0, max: 2, troopEntries: entries('LFT') }),
            ],
          }),
          allyContingent({
            id: 'second',
            troopOptions: [
              troopOption({ min: 0, max: 2, troopEntries: entries('WBD') }),
            ],
          }),
        ],
      }),
    );
    const [first, second] = optionalOnly.contingentGroups;
    if (!first || !second) {
      throw new Error('the optional contingent army lost its groups');
    }
    const selection = withContingentGroup(
      withContingentGroup(legal, first),
      second,
    );

    expect(codesFor(selection, optionalOnly)).not.toContain(
      'multipleAllyTroopOptions',
    );
  });

  it('reports a second Ally Troop Option against each of them', () => {
    const twoAllies = buildArmyList(
      armyDetail({
        allyOptions: [
          {
            allyEntries: [{ allyArmyList: 'first', name: 'First ally' }],
            dateRange: null,
            note: null,
          },
          {
            allyEntries: [{ allyArmyList: 'second', name: 'Second ally' }],
            dateRange: null,
            note: null,
          },
        ],
        allyContingents: [
          allyContingent({
            id: 'first',
            internalContingent: false,
            troopOptions: [
              troopOption({ min: 0, max: 2, troopEntries: entries('HBW') }),
            ],
          }),
          allyContingent({
            id: 'second',
            internalContingent: false,
            troopOptions: [
              troopOption({ min: 0, max: 2, troopEntries: entries('WBD') }),
            ],
          }),
        ],
      }),
    );
    const [first, second] = twoAllies.contingentGroups;
    if (!first || !second) {
      throw new Error('the two ally army lost its groups');
    }
    const one = withContingentGroup(legal, first);

    expect(codesFor(one, twoAllies)).not.toContain('multipleAllyTroopOptions');
    expect(
      only(
        findingsFor(withContingentGroup(one, second), twoAllies),
        'multipleAllyTroopOptions',
      ),
    ).toEqual([
      {
        code: 'multipleAllyTroopOptions',
        severity: 'error',
        message: 'An army may take one Ally Troop Option, 2 selected',
        target: { kind: 'contingentGroup', group: first.id },
      },
      {
        code: 'multipleAllyTroopOptions',
        severity: 'error',
        message: 'An army may take one Ally Troop Option, 2 selected',
        target: { kind: 'contingentGroup', group: second.id },
      },
    ]);
  });

  it('reports a contingent the army cannot take in the chosen year', () => {
    const early = withStands(
      withContingentGroup({ ...legal, year: -2980 }, allyGroup),
      horseBow,
      'HBW',
      2,
    );
    const found = codesFor(early);

    expect(found).toContain('contingentGroupUnavailable');
    expect(found).not.toContain('troopOptionUnavailable');
  });

  it('reports a contingent group the army does not offer', () => {
    const selection = {
      ...legal,
      contingentGroups: ['group/9' as ContingentGroupId],
    };

    expect(only(findingsFor(selection), 'unknownContingentGroup')).toEqual([
      {
        code: 'unknownContingentGroup',
        severity: 'warning',
        message: 'The selection takes a contingent Fixture Army does not offer',
        target: { kind: 'contingentGroup', group: 'group/9' },
      },
    ]);
  });
});

describe('stands the army is not carrying', () => {
  it('leaves stands in an untaken contingent uncounted', () => {
    const selection = withStands(legal, lightFoot, 'LFT', 2);

    expect(findingsFor(selection)).toEqual([
      {
        code: 'contingentNotTaken',
        severity: 'info',
        message:
          'Light Foot is in a contingent the army has not taken, and is not counted',
        target: { kind: 'troopOption', option: lightFoot.id },
      },
    ]);
  });

  it('reports stands in an option the year has gated away', () => {
    const later = { ...legal, year: -2800 };

    expect(only(findingsFor(later), 'troopOptionUnavailable')).toEqual([
      {
        code: 'troopOptionUnavailable',
        severity: 'error',
        message:
          'Archers or Bow Levy is not offered at the chosen year and sub-faction',
        target: { kind: 'troopOption', option: archers.id },
      },
    ]);
  });

  it('reports stands in a contingent option the year has gated away', () => {
    const dated = buildArmyList(
      armyDetail({
        allyOptions: [
          {
            allyEntries: [{ allyArmyList: 'dated', name: 'Dated friends' }],
            dateRange: null,
            note: null,
          },
        ],
        allyContingents: [
          allyContingent({
            id: 'dated',
            troopOptions: [
              troopOption({
                min: 0,
                max: 2,
                troopEntries: entries('LFT'),
                dateRanges: [{ startDate: -3000, endDate: -2900 }],
              }),
            ],
          }),
        ],
      }),
    );
    const group = dated.contingentGroups[0];
    const option = group?.contingents[0].troopOptions[0];
    if (!group || !option) {
      throw new Error('the dated contingent army lost its troop option');
    }
    const selection = withStands(
      withContingentGroup(
        { ...withStands(legal, archers, 'ARC', 0), year: -2850 },
        group,
      ),
      option,
      'LFT',
      2,
    );

    expect(
      only(findingsFor(selection, dated), 'troopOptionUnavailable'),
    ).toEqual([
      {
        code: 'troopOptionUnavailable',
        severity: 'error',
        message: 'Light Foot is not offered at the chosen year and sub-faction',
        target: { kind: 'troopOption', option: option.id },
      },
    ]);
  });

  it('reports stands in an option the army does not have', () => {
    const selection = {
      ...legal,
      stands: { ...legal.stands, ['main/9' as TroopOptionId]: { SPR: 1 } },
    };

    expect(only(findingsFor(selection), 'unknownTroopOption')).toEqual([
      {
        code: 'unknownTroopOption',
        severity: 'warning',
        message:
          'The selection fills a troop option Fixture Army does not have',
        target: { kind: 'troopOption', option: 'main/9' },
      },
    ]);
  });

  it('ignores an option the selection mentions but does not fill', () => {
    const selection = withStands(
      withStands(legal, lightFoot, 'LFT', 2),
      lightFoot,
      'LFT',
      0,
    );

    expect(findingsFor(selection)).toEqual([]);
  });
});

describe('the general', () => {
  it('reports an army with no general', () => {
    expect(only(findingsFor(filled), 'generalMissing')).toEqual([
      {
        code: 'generalMissing',
        severity: 'error',
        message: 'One stand in the army must be the general',
        target: { kind: 'general' },
      },
    ]);
  });

  it('reports a general that is not one of the stands', () => {
    const selection = {
      ...legal,
      general: { option: knights.id, troopType: 'KNT' as const },
      stands: { ...legal.stands, [knights.id]: {} },
    };

    expect(only(findingsFor(selection), 'generalStandMissing')).toEqual([
      {
        code: 'generalStandMissing',
        severity: 'error',
        message: 'The general is a Knights stand the army has not taken',
        target: { kind: 'general' },
      },
    ]);
  });

  it('reports a general drawn from a troop type the list does not allow', () => {
    const selection = withGeneral(filled, {
      option: archers.id,
      troopType: 'ARC',
    });

    expect(only(findingsFor(selection), 'generalTroopTypeNotAllowed')).toEqual([
      {
        code: 'generalTroopTypeNotAllowed',
        severity: 'error',
        message: 'The general must be Spear or Knights, not Archers',
        target: { kind: 'general' },
      },
    ]);
  });

  it('never lets an allied stand be the general', () => {
    const allied = buildArmyList(
      armyDetail({
        troopEntriesForGeneral: [{ troopEntries: entries('SPR', 'HBW') }],
      }),
    );
    const group = allied.contingentGroups[1];
    const option = group?.contingents[1]?.troopOptions[0];
    if (!group || !option) {
      throw new Error('the allied army lost its contingent');
    }
    const selection = withGeneral(
      withStands(withContingentGroup(filled, group), option, 'HBW', 2),
      { option: option.id, troopType: 'HBW' },
    );

    expect(
      only(findingsFor(selection, allied), 'generalFromAlliedContingent'),
    ).toEqual([
      {
        code: 'generalFromAlliedContingent',
        severity: 'error',
        message:
          'The general cannot be a stand of Fixture Allied Contingent, an allied contingent',
        target: { kind: 'general' },
      },
    ]);
  });
});

const shooters = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({
        battleCardEntries: [
          battleCardEntry({ battleCardCode: 'PL', min: 0, max: 2 }),
        ],
      }),
    ],
  }),
);

describe('battle cards', () => {
  it('reports an army card the list does not offer', () => {
    const selection = withArmyBattleCard(legal, 'AM', 1);

    expect(only(findingsFor(selection), 'battleCardUnavailable')).toEqual([
      {
        code: 'battleCardUnavailable',
        severity: 'error',
        message: 'Ambush is not offered to Fixture Army',
        target: { kind: 'armyBattleCard', code: 'AM' },
      },
    ]);
  });

  it('reports cards in code order, whatever order they were bought in', () => {
    const selection = withArmyBattleCard(
      withArmyBattleCard(legal, 'PT', 1),
      'AM',
      1,
    );

    expect(
      only(findingsFor(selection), 'battleCardUnavailable').map(
        ({ target }) => target,
      ),
    ).toEqual([
      { kind: 'armyBattleCard', code: 'AM' },
      { kind: 'armyBattleCard', code: 'PT' },
    ]);
    expect(
      findingsFor(
        withArmyBattleCard(withArmyBattleCard(legal, 'AM', 1), 'PT', 1),
      ),
    ).toEqual(findingsFor(selection));
  });

  it('reports a troop card the option does not offer', () => {
    const selection = withTroopBattleCard(legal, knights, 'HL', 1);

    expect(only(findingsFor(selection), 'battleCardUnavailable')).toEqual([
      {
        code: 'battleCardUnavailable',
        severity: 'error',
        message: 'Hold the Line is not offered to Knights',
        target: { kind: 'troopBattleCard', code: 'HL', option: knights.id },
      },
    ]);
  });

  it('holds an army card to its maximum and its minimum', () => {
    const bounded = buildArmyList(
      armyDetail({
        battleCardEntries: [
          battleCardEntry({ battleCardCode: 'FC', min: 1, max: 1 }),
        ],
      }),
    );

    expect(only(findingsFor(legal, bounded), 'battleCardBelowMin')).toEqual([
      {
        code: 'battleCardBelowMin',
        severity: 'error',
        message:
          'Fixture Army needs at least 1 copy of Fortified Camp, 0 copies selected',
        target: { kind: 'armyBattleCard', code: 'FC' },
      },
    ]);
    expect(
      only(
        findingsFor(withArmyBattleCard(legal, 'FC', 2), bounded),
        'battleCardAboveMax',
      ),
    ).toEqual([
      {
        code: 'battleCardAboveMax',
        severity: 'error',
        message:
          'Fixture Army allows at most 1 copy of Fortified Camp, 2 copies selected',
        target: { kind: 'armyBattleCard', code: 'FC' },
      },
    ]);
  });

  it('holds a troop card to the stands the option may attach it to', () => {
    const selection = withTroopBattleCard(legal, spearmen, 'PL', 3);

    expect(
      only(findingsFor(selection, shooters), 'battleCardAboveMax'),
    ).toEqual([
      {
        code: 'battleCardAboveMax',
        severity: 'error',
        message:
          'Spear allows at most 2 stands of Plaustrella, 3 stands selected',
        target: { kind: 'troopBattleCard', code: 'PL', option: spearmen.id },
      },
    ]);
  });

  it('reports a card applied to more stands than the option holds', () => {
    const selection = withTroopBattleCard(
      withStands(legal, spearmen, 'SPR', 2),
      spearmen,
      'PL',
      2,
    );
    const found = only(
      findingsFor(withStands(selection, spearmen, 'SPR', 1), shooters),
      'battleCardStandsExceedOption',
    );

    expect(
      only(findingsFor(selection, shooters), 'battleCardStandsExceedOption'),
    ).toEqual([]);
    expect(found).toEqual([
      {
        code: 'battleCardStandsExceedOption',
        severity: 'error',
        message: 'Plaustrella is applied to 2 stands, Spear has 1 stand',
        target: { kind: 'troopBattleCard', code: 'PL', option: spearmen.id },
      },
    ]);
  });

  it('reports a whole troop entry card bought for an option with no stands', () => {
    const selection = withTroopBattleCard(
      withStands(legal, spearmen, 'SPR', 0),
      spearmen,
      'HL',
      1,
    );

    expect(
      only(findingsFor(selection), 'battleCardStandsExceedOption'),
    ).toEqual([
      {
        code: 'battleCardStandsExceedOption',
        severity: 'error',
        message: 'Hold the Line is bought for Spear, which has no stands',
        target: { kind: 'troopBattleCard', code: 'HL', option: spearmen.id },
      },
    ]);
  });

  it('caps the Hold the Line cards an army may purchase', () => {
    const selection = withTroopBattleCard(
      withTroopBattleCard(
        withTroopBattleCard(
          withTroopBattleCard(legal, spearmen, 'HL', 1),
          archers,
          'HL',
          1,
        ),
        knights,
        'HL',
        1,
      ),
      lightFoot,
      'HL',
      1,
    );
    const taken = withStands(
      withContingentGroup(selection, optionalGroup),
      lightFoot,
      'LFT',
      1,
    );

    expect(
      only(findingsFor(taken), 'battleCardPurchaseLimit').map(
        ({ message, target }) => ({ message, target }),
      ),
    ).toEqual(
      [lightFoot, spearmen, archers, knights].map((option) => ({
        message: 'An army may purchase 3 Hold the Line cards, 4 selected',
        target: { kind: 'troopBattleCard', code: 'HL', option: option.id },
      })),
    );
  });

  it('caps the Hold the Line cards one troop entry may carry too', () => {
    const selection = withTroopBattleCard(legal, spearmen, 'HL', 4);

    expect(only(findingsFor(selection), 'battleCardPurchaseLimit')).toEqual([
      {
        code: 'battleCardPurchaseLimit',
        severity: 'error',
        message: 'An army may purchase 3 Hold the Line cards, 4 selected',
        target: { kind: 'troopBattleCard', code: 'HL', option: spearmen.id },
      },
    ]);
  });

  it('reports a purchase limit against the army when no option carries it', () => {
    const selection = withArmyBattleCard(legal, 'HL', 4);

    expect(only(findingsFor(selection), 'battleCardPurchaseLimit')).toEqual([
      {
        code: 'battleCardPurchaseLimit',
        severity: 'error',
        message: 'An army may purchase 3 Hold the Line cards, 4 selected',
        target: { kind: 'armyBattleCard', code: 'HL' },
      },
    ]);
  });

  it('holds a card that goes on pairs of stands to an even number', () => {
    const pairs = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption({
            battleCardEntries: [battleCardEntry({ battleCardCode: 'SV' })],
          }),
        ],
      }),
    );

    expect(
      only(
        findingsFor(withTroopBattleCard(legal, spearmen, 'SV', 3), pairs),
        'battleCardNeedsPairsOfStands',
      ),
    ).toEqual([
      {
        code: 'battleCardNeedsPairsOfStands',
        severity: 'error',
        message:
          'Separated Valets goes on pairs of stands, Spear has it on 3 stands',
        target: { kind: 'troopBattleCard', code: 'SV', option: spearmen.id },
      },
    ]);
    expect(
      only(
        findingsFor(withTroopBattleCard(legal, spearmen, 'SV', 4), pairs),
        'battleCardNeedsPairsOfStands',
      ),
    ).toEqual([]);
  });

  it('reports an Elephant Screen bought alongside elephant stands', () => {
    const screened = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption({
            troopEntries: entries('ELE'),
            battleCardEntries: [battleCardEntry({ battleCardCode: 'ES' })],
          }),
        ],
      }),
    );
    const elephants = screened.main.troopOptions[0];
    if (!elephants) {
      throw new Error('the screened fixture has no elephant option');
    }
    const stood = withStands(empty, elephants, 'ELE', 2);

    expect(
      only(
        findingsFor(withTroopBattleCard(stood, elephants, 'ES', 1), screened),
        'battleCardForbidsTroopType',
      ),
    ).toEqual([
      {
        code: 'battleCardForbidsTroopType',
        severity: 'error',
        message: 'Elephant Screen may not be taken with Elephants in the army',
        target: { kind: 'troopBattleCard', code: 'ES', option: elephants.id },
      },
    ]);
    expect(
      only(findingsFor(stood, screened), 'battleCardForbidsTroopType'),
    ).toEqual([]);
  });

  it('cites the live card text for the Hold the Line cap', () => {
    const mdText =
      sampleSnapshotBattleCards.find(
        ({ permanentCode }) => permanentCode === 'HL',
      )?.mdText ?? '';

    expect(mdText).toContain(
      `No army may buy more than ${battleCardPurchaseLimits.HL} Hold the Line cards.`,
    );
  });
});

describe('on the sample snapshot', () => {
  let lists: ArmyList[];

  beforeAll(async () => {
    lists = await sampleArmyLists();
  });

  it('reports on every army in the snapshot without throwing', () => {
    const severities = new Set(
      lists.flatMap((armyList) =>
        validateArmy(
          armyList,
          emptySelection({
            army: armyList.id,
            dataVersion,
            year: armyList.dateRange.startDate,
          }),
          costs,
          names,
        ).map(({ severity }) => severity),
      ),
    );

    expect([...severities].sort()).toEqual(['error', 'warning']);
  });

  it('accepts a sample army built to 48 points', () => {
    const goblins = lists.find(({ key }) => key === '1a');
    const general = goblins?.main.troopOptions[0];
    const bowmen = goblins?.main.troopOptions[1];
    if (!goblins || !general || !bowmen) {
      throw new Error(
        'Goblin Warrens is not the army the test was written for',
      );
    }
    const selection = withGeneral(
      withStands(
        withStands(
          emptySelection({
            army: goblins.id,
            dataVersion,
            year: goblins.dateRange.startDate,
          }),
          general,
          'ARC',
          1,
        ),
        bowmen,
        'BLV',
        22,
      ),
      { option: general.id, troopType: 'ARC' },
    );

    expect(validateArmy(goblins, selection, costs, names)).toEqual([]);
  });
});
