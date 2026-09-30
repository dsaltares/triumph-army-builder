import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BattleCardsSection } from '@/components/builder/battle-cards';
import { type BattleCardText, bundlePaths } from '@/lib/data/bundle';
import { battleCardCodes } from '@/lib/data/schema';
import type { SubFactionGroup } from '@/lib/data/sub-factions';
import { type ArmyList, buildArmyList } from '@/lib/domain/army/army-list';
import { battleCardChoices } from '@/lib/domain/army/battle-card-selection';
import {
  type ArmySelection,
  emptySelection,
  withArmyBattleCard,
  withStands,
  withTroopBattleCard,
} from '@/lib/domain/army/selection';
import { troopTypeCosts, troopTypeNames } from '@/lib/domain/troop-types';
import { serveApi } from '@/test/api';
import {
  armyDetail,
  battleCardEntry,
  entries,
  troopOption,
} from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const rulesText = Object.fromEntries(
  battleCardCodes.map((code) => [code, `The ${code} rules.`]),
) as BattleCardText;

const api = serveApi({
  bundle: { [bundlePaths.battleCardText]: rulesText },
  translated: {
    es: {
      [bundlePaths.battleCardText]: { ...rulesText, FC: 'Las reglas de FC.' },
    },
  },
});

const troopTypes = sampleTroopTypes;
const costs = {
  troopTypes: troopTypeCosts(troopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(troopTypes);

const subFactions: SubFactionGroup = {
  army: 'Fixture Army',
  label: 'Sub-faction',
  variants: [{ id: 'kish', name: 'Kish' }],
  rules: { 'only Kish': { only: ['kish'] } },
};

const list = buildArmyList(
  armyDetail({
    battleCardEntries: [battleCardEntry({ note: 'Wagon laager' })],
    troopOptions: [
      troopOption({
        troopEntries: entries('HBW'),
        battleCardEntries: [
          battleCardEntry({ battleCardCode: 'PL', min: 0, max: 2 }),
          battleCardEntry({ battleCardCode: 'SS' }),
          battleCardEntry({ battleCardCode: 'DD' }),
        ],
      }),
      troopOption({
        min: 0,
        max: 4,
        troopEntries: entries('SPR'),
        battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
      }),
    ],
    subFactions,
  }),
);

const [bowmen, spearmen] = list.main.troopOptions;

if (!bowmen || !spearmen) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-18.abcdef01',
  year: -2950,
  variant: 'kish',
});

const show = (selection: ArmySelection = empty, armyList: ArmyList = list) =>
  renderUi(
    <BattleCardsSection
      choices={battleCardChoices(armyList, selection, costs)}
      troopTypeNames={names}
      onArmyCardChange={() => {}}
      onTroopCardChange={() => {}}
    />,
    { wrap: api.wrap },
  );

const group = (heading: string) => {
  const found = screen
    .getByRole('heading', { name: heading, level: 3 })
    .closest('li');
  if (!found) {
    throw new Error(`the ${heading} card group is not inside a list item`);
  }
  return within(found);
};

const stepper = (label: string) => screen.getByRole('button', { name: label });

describe('BattleCardsSection', () => {
  it('separates the army-wide cards from the ones a troop option offers', () => {
    show();

    expect(
      group('The army as a whole').getByText('Fortified Camp'),
    ).toBeInTheDocument();
    expect(group('Horse Bow').getByText('Plaustrella')).toBeInTheDocument();
  });

  it('counts an army-wide card in copies and a troop card in stands', () => {
    show();

    expect(stepper('One more Fortified Camp copy')).toBeInTheDocument();
    expect(screen.getByLabelText('Fortified Camp copies')).toBeInTheDocument();
    expect(stepper('One more Plaustrella stand')).toBeInTheDocument();
    expect(screen.getByLabelText('Plaustrella stands')).toBeInTheDocument();
  });

  it('says how a card is priced', () => {
    show();

    expect(group('Horse Bow').getAllByText('1 point per stand')).toHaveLength(
      2,
    );
  });

  it('says what a card costs once it is taken', () => {
    show(
      withTroopBattleCard(withStands(empty, bowmen, 'HBW', 2), bowmen, 'PL', 2),
    );

    expect(
      group('Horse Bow').getByText('1 point per stand · 2 points'),
    ).toBeInTheDocument();
  });

  it('prints the allowance the army list states beside a card', () => {
    show();

    expect(group('Horse Bow').getByText('0–2 stands')).toBeInTheDocument();
  });

  it('names the unit even when the army list states no allowance', () => {
    show();

    expect(group('Spear').getByText('cards')).toBeInTheDocument();
    expect(group('Horse Bow').getAllByText('purchases')).toHaveLength(2);
  });

  it('counts a card bought for a whole troop entry in cards, and says why', () => {
    show(withStands(empty, spearmen, 'SPR', 4));

    expect(
      group('Spear').getByText(
        'Each card covers every stand this option holds.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Hold the Line cards')).toBeInTheDocument();
    expect(stepper('One more Hold the Line card')).toBeEnabled();
  });

  it('buys a whole troop entry card up to its army maximum, and prices it', () => {
    show(
      withTroopBattleCard(
        withStands(empty, spearmen, 'SPR', 4),
        spearmen,
        'HL',
        3,
      ),
    );

    expect(screen.getByLabelText('Hold the Line cards')).toHaveTextContent('3');
    expect(stepper('One more Hold the Line card')).toBeDisabled();
    expect(
      group('Spear').getByText(
        'Free for the first, then 1 point each · 2 points',
      ),
    ).toBeInTheDocument();
  });

  it('carries the note the army list prints beside a card', () => {
    show();

    expect(
      group('The army as a whole').getByText('Wagon laager'),
    ).toBeInTheDocument();
  });

  it('cannot put a card on an option holding no stands, and says so', () => {
    show();

    expect(
      group('Horse Bow').getByText(
        'Take stands from this option in Required Troops, then put its cards on them.',
      ),
    ).toBeInTheDocument();
    expect(stepper('One more Plaustrella stand')).toBeDisabled();
  });

  it('opens the steppers once the option holds stands', () => {
    show(withStands(empty, bowmen, 'HBW', 2));

    expect(
      group('Horse Bow').getByText('Put on the 2 stands this option holds.'),
    ).toBeInTheDocument();
    expect(stepper('One more Plaustrella stand')).toBeEnabled();
  });

  it('stops a card at the stands the option holds', () => {
    show(
      withTroopBattleCard(withStands(empty, bowmen, 'HBW', 1), bowmen, 'PL', 1),
    );

    expect(stepper('One more Plaustrella stand')).toBeDisabled();
    expect(stepper('One fewer Plaustrella stand')).toBeEnabled();
  });

  it('says an all-or-none card covers every stand the option holds', () => {
    show(withStands(empty, bowmen, 'HBW', 3));

    expect(
      group('Horse Bow').getByText(
        'One purchase covers every stand this option holds, all or none.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Shower Shooting purchases'),
    ).toHaveTextContent('0');
  });

  it('charges an all-or-none card for the whole option, bought once', () => {
    show(
      withTroopBattleCard(withStands(empty, bowmen, 'HBW', 3), bowmen, 'SS', 1),
    );

    expect(stepper('One more Shower Shooting purchase')).toBeDisabled();
    expect(
      group('Horse Bow').getByText('1 point per stand · 3 points'),
    ).toBeInTheDocument();
  });

  it('buys a card whose purchase covers the army once, and says why', () => {
    show(withStands(empty, bowmen, 'HBW', 3));

    expect(
      group('Horse Bow').getByText(
        'One purchase covers the army, however many troop options it is on.',
      ),
    ).toBeInTheDocument();
    expect(
      stepper('One more Deployment Dismounting purchase'),
    ).toBeInTheDocument();
  });

  it('caps an army-wide card with no stated maximum at one copy', () => {
    show(withArmyBattleCard(empty, 'FC', 1));

    expect(stepper('One more Fortified Camp copy')).toBeDisabled();
  });

  it('marks a card past the maximum the army list allows', () => {
    show(
      withTroopBattleCard(withStands(empty, bowmen, 'HBW', 4), bowmen, 'PL', 3),
    );

    expect(
      group('Horse Bow').getByText(/1 over the maximum/),
    ).toBeInTheDocument();
  });

  it('reports a card left on more stands than the option still holds', () => {
    const applied = withTroopBattleCard(
      withStands(empty, bowmen, 'HBW', 2),
      bowmen,
      'PL',
      2,
    );

    show(withStands(applied, bowmen, 'HBW', 1));

    expect(
      group('Horse Bow').getByText(
        /Plaustrella is on more stands than this option holds/,
      ),
    ).toBeInTheDocument();
  });

  it('reports a whole troop entry card left on an option with no stands', () => {
    const applied = withTroopBattleCard(
      withStands(empty, spearmen, 'SPR', 2),
      spearmen,
      'HL',
      1,
    );

    show(withStands(applied, spearmen, 'SPR', 0));

    expect(
      group('Spear').getByText(
        /Hold the Line is on an option that holds no stands/,
      ),
    ).toBeInTheDocument();
  });

  it('keeps a withheld option that still holds a card, and says why', () => {
    const withheld = buildArmyList(
      armyDetail({
        battleCardEntries: [],
        troopOptions: [
          troopOption({
            troopEntries: entries('SPR'),
            note: 'only Kish',
            battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
          }),
        ],
        subFactions,
      }),
    );
    const option = withheld.main.troopOptions[0];
    if (!option) {
      throw new Error('the withheld fixture has no troop option');
    }
    const applied = withTroopBattleCard(
      withStands(empty, option, 'SPR', 2),
      option,
      'HL',
      2,
    );

    show({ ...applied, variant: null }, withheld);

    expect(
      group('Spear').getByText('Not offered to this sub-faction'),
    ).toBeInTheDocument();
    expect(
      group('Spear').getByText(/Its cards still count toward the army/),
    ).toBeInTheDocument();
    expect(stepper('One more Hold the Line card')).toBeDisabled();
    expect(stepper('One fewer Hold the Line card')).toBeEnabled();
  });

  it('counts what is offered, what is taken and what it costs', () => {
    show();

    expect(
      screen.getByText('0 of 5 cards taken · 0 points from battle cards'),
    ).toBeInTheDocument();
  });

  it('counts a card once it is bought', () => {
    show(withArmyBattleCard(empty, 'FC', 1));

    expect(
      screen.getByText('1 of 5 cards taken · 1 point from battle cards'),
    ).toBeInTheDocument();
  });

  it('says so when the army is offered no cards at all', () => {
    const bare = buildArmyList(
      armyDetail({
        battleCardEntries: [],
        troopOptions: [troopOption({ troopEntries: entries('SPR') })],
      }),
    );

    show(empty, bare);

    expect(
      screen.getByText('This army is offered no battle cards.'),
    ).toBeInTheDocument();
  });

  it('re-reads the rules when the player changes language', async () => {
    const { user, changeLocale } = show();

    await user.click(
      screen.getByRole('button', { name: /^Fortified Camp\s*rules$/ }),
    );
    expect(await screen.findByText('The FC rules.')).toBeInTheDocument();

    changeLocale('es');

    expect(await screen.findByText('Las reglas de FC.')).toBeInTheDocument();
  });

  it('offers the rules of every card it lists', () => {
    show();

    expect(
      screen.getByRole('button', { name: /^Fortified Camp\s*rules$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Plaustrella\s*rules$/ }),
    ).toBeInTheDocument();
  });
});
