import { describe, expect, it } from 'vitest';
import { buildArmyList } from '@/lib/domain/army/army-list';
import {
  type ArmySelection,
  emptySelection,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withStands,
} from '@/lib/domain/army/selection';
import { armySheet } from '@/lib/domain/army/sheet';
import {
  type TroopTypeMovements,
  troopTypeCosts,
  troopTypeFactors,
  troopTypeNames,
} from '@/lib/domain/troop-types';
import {
  armyListText,
  type ListTextFormat,
  listTextFormats,
} from '@/lib/export/list-text';
import {
  allyContingent,
  armyDetail,
  entries,
  troopOption,
} from '@/test/fixtures/army';
import {
  sampleBattleCardCosts,
  sampleCuration,
  sampleTroopTypes,
} from '@/test/sample.ts';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);
const factors = troopTypeFactors(sampleTroopTypes);

const list = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({ description: 'Spearmen' }),
      troopOption({
        min: 0,
        max: 4,
        core: 'half',
        description: 'Archers',
        note: 'only Kish',
        troopEntries: entries('ARC'),
      }),
      troopOption({
        min: 0,
        max: 2,
        core: '',
        description: '',
        troopEntries: entries('KNT'),
      }),
    ],
    allyOptions: [
      {
        allyEntries: [
          { allyArmyList: 'contingent-optional', name: 'Optional friends' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-ally', name: 'Allied friends' },
        ],
        dateRange: null,
        note: null,
      },
    ],
    allyContingents: [
      allyContingent({
        troopOptions: [
          troopOption({
            min: 1,
            max: 2,
            core: '',
            description: 'Skirmishers',
            troopEntries: entries('LFT'),
          }),
        ],
      }),
      allyContingent({
        id: 'contingent-ally',
        name: 'Fixture Allied Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({
            min: 2,
            max: 4,
            core: '',
            description: 'Horse bowmen',
            troopEntries: entries('HBW'),
          }),
        ],
      }),
    ],
  }),
);

const spearmen = list.main.troopOptions[0];
const archers = list.main.troopOptions[1];
const knights = list.main.troopOptions[2];
const optionalGroup = list.contingentGroups[0];
const allyGroup = list.contingentGroups[1];
const skirmishers = optionalGroup?.contingents[0]?.troopOptions[0];
const horseBowmen = allyGroup?.contingents[0]?.troopOptions[0];

if (
  !spearmen ||
  !archers ||
  !knights ||
  !optionalGroup ||
  !allyGroup ||
  !skirmishers ||
  !horseBowmen
) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

const siteUrl = 'https://triumph.example';

const textOf = (
  selection: ArmySelection,
  format: ListTextFormat = 'plain',
  listName = 'Kish at dawn',
  movement: TroopTypeMovements = sampleCuration.movement,
) =>
  armyListText(
    armySheet({
      listName,
      armyList: list,
      selection,
      costs,
      names,
      factors,
      movement,
      cardNames: { FC: 'Fortified Camp', HL: 'Hold the Line' },
    }),
    { format, siteUrl, locale: 'en' },
  );

const built = withGeneral(
  withStands(withStands(empty, spearmen, 'SPR', 2), archers, 'ARC', 1),
  { option: spearmen.id, troopType: 'SPR' },
);

describe('the heading', () => {
  it('names the list, the army it came from and where the points stand', () => {
    expect(textOf(built).split('\n').slice(0, 3)).toEqual([
      'Kish at dawn',
      'Fixture Army · List 1a · 3000–2800 BC',
      `${2 * costs.troopTypes.SPR + costs.troopTypes.ARC} points · 3 stands · 2900 BC`,
    ]);
  });

  it('names the general by the stand and the option carrying it', () => {
    expect(textOf(built)).toContain(`General: ${names.SPR} (Spearmen)`);
  });

  it('says so when nobody is leading the army', () => {
    expect(textOf(withStands(empty, spearmen, 'SPR', 2))).toContain(
      'General: not chosen',
    );
  });

  it('carries the camp, the ratings and the home topography', () => {
    const text = textOf(withArmyBattleCard(built, 'FC', 1));
    expect(text).toContain('Camp: Fortified camp');
    expect(text).toContain('Invasion rating: 2');
    expect(text).toContain('Manoeuvre rating: 1');
    expect(text).toContain('Home topography: Arable');
  });
});

describe('the contingents', () => {
  it('groups the stands under the troop option they came from', () => {
    expect(textOf(built)).toContain(
      [
        'Spearmen [battle line]',
        `  2 × ${names.SPR} (general) — ${2 * costs.troopTypes.SPR} points · 3 MU`,
      ].join('\n'),
    );
  });

  it('writes a dash for the movement the data does not give', () => {
    expect(textOf(built, 'plain', 'Kish at dawn', {})).toContain(
      `  2 × ${names.SPR} (general) — ${2 * costs.troopTypes.SPR} points · —\n`,
    );
  });

  it('carries the note and the battle line standing beside the option', () => {
    expect(textOf(built)).toContain('Archers (only Kish) [half battle line]\n');
  });

  it('lists the stands on their own when the option has no description', () => {
    const text = textOf(withStands(built, knights, 'KNT', 1));
    expect(text).toContain(
      `\n1 × ${names.KNT} — ${costs.troopTypes.KNT} points · 5 MU\n`,
    );
  });

  it('heads each contingent with its stands and its points', () => {
    expect(textOf(built)).toContain(
      `MAIN CONTINGENT — 3 stands, ${2 * costs.troopTypes.SPR + costs.troopTypes.ARC} points`,
    );
  });

  it('marks an optional contingent and an allied one for what they are', () => {
    const selection = withStands(
      withStands(
        withContingentGroup(
          withContingentGroup(built, optionalGroup),
          allyGroup,
        ),
        skirmishers,
        'LFT',
        1,
      ),
      horseBowmen,
      'HBW',
      2,
    );
    const text = textOf(selection);
    expect(text).toContain(
      'FIXTURE OPTIONAL CONTINGENT (OPTIONAL CONTINGENT) —',
    );
    expect(text).toContain('FIXTURE ALLIED CONTINGENT (ALLIED CONTINGENT) —');
    expect(text).toContain(
      `FIXTURE ALLIED CONTINGENT (ALLIED CONTINGENT) — 2 stands, ${2 * costs.troopTypes.HBW} points`,
    );
  });

  it('states the totals once, under the title', () => {
    const text = textOf(built);
    const total = `${2 * costs.troopTypes.SPR + costs.troopTypes.ARC} points · 3 stands`;
    expect(text.split(total)).toHaveLength(2);
  });

  it('says so when no stands have been taken', () => {
    expect(textOf(empty)).toContain('This list has no stands yet.');
  });
});

describe('the battle cards', () => {
  it('names each card, its copies and what it costs', () => {
    expect(textOf(withArmyBattleCard(built, 'HL', 2))).toContain(
      'Hold the Line ×2',
    );
  });

  it('counts a single copy in the singular', () => {
    expect(textOf(withArmyBattleCard(built, 'FC', 1))).toContain(
      'Fortified Camp — 1 point',
    );
  });

  it('says so when none were taken', () => {
    expect(textOf(built)).toContain('No battle cards taken.');
  });
});

describe('the footer', () => {
  it('links back to the army and names the data it was built from', () => {
    expect(textOf(built).split('\n').slice(-2)).toEqual([
      `Built with Triumph! Army Builder — ${siteUrl}/armies/army-1`,
      'Army list data from Meshwesh, version 2026-09-17.abcdef01',
    ]);
  });
});

describe('markdown', () => {
  it('marks the list name, the contingents and the stands up', () => {
    const text = textOf(built, 'markdown');
    expect(text).toContain('# Kish at dawn');
    expect(text).toContain('## Main contingent — 3 stands');
    expect(text).toContain(
      `- Spearmen [battle line]\n  - 2 × ${names.SPR} (general) — ${2 * costs.troopTypes.SPR} points · 3 MU`,
    );
  });

  it('emphasises the points the list comes to', () => {
    expect(textOf(built, 'markdown')).toContain(
      `**${2 * costs.troopTypes.SPR + costs.troopTypes.ARC} points · 3 stands · 2900 BC**`,
    );
  });
});

describe('bbcode', () => {
  it('bolds the list name and the contingent headings', () => {
    const text = textOf(built, 'bbcode');
    expect(text).toContain('[b]Kish at dawn[/b]');
    expect(text).toContain('[b]Main contingent[/b] — 3 stands');
  });

  it('nests the stands in a list under their troop option', () => {
    expect(textOf(built, 'bbcode')).toContain(
      [
        '[*]Spearmen [battle line]',
        '[list]',
        `[*]2 × ${names.SPR} (general) — ${2 * costs.troopTypes.SPR} points · 3 MU`,
        '[/list]',
      ].join('\n'),
    );
  });

  it('closes every list it opens', () => {
    const text = textOf(built, 'bbcode');
    expect(text.split('[list]')).toHaveLength(text.split('[/list]').length);
  });
});

describe('every format', () => {
  it.each(listTextFormats)(
    'renders %s without a trailing blank line',
    (format) => {
      const text = textOf(built, format);
      expect(text).not.toMatch(/\n\s*$/);
      expect(text).not.toContain('\n\n\n');
    },
  );
});
