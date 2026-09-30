import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RequiredTroopsSection } from '@/components/builder/required-troops';
import type { SubFactionGroup } from '@/lib/data/sub-factions';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { emptySelection, withStands } from '@/lib/domain/army/selection';
import { requiredTroops } from '@/lib/domain/army/troop-selection';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeNames,
  troopTypeProfiles,
} from '@/lib/domain/troop-types';
import { armyDetail, entries, troopOption } from '@/test/fixtures/army';
import {
  sampleBattleCardCosts,
  sampleTroopTypes,
  withRulebookValues,
} from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const unmeasuredTroopTypes = sampleTroopTypes;
const troopTypes = unmeasuredTroopTypes.map(withRulebookValues);
const costs = {
  troopTypes: troopTypeCosts(troopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(troopTypes);
const factors = troopTypeFactors(troopTypes);
const profiles = troopTypeProfiles(troopTypes);

const subFactions: SubFactionGroup = {
  army: 'Fixture Army',
  label: 'Sub-faction',
  variants: [
    { id: 'kish', name: 'Kish' },
    { id: 'other', name: 'Other city-states' },
  ],
  rules: { 'only Kish': { only: ['kish'] } },
};

const list = buildArmyList(armyDetail({ subFactions }));

const datedList = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({
        troopEntries: entries('SPR'),
        dateRanges: [{ startDate: -3000, endDate: -2900 }],
      }),
    ],
  }),
);

const [spearmen, archers] = list.main.troopOptions;

if (!spearmen || !archers) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2950,
  variant: 'kish',
});

const show = (selection = empty, armyList = list, onStandsChange = () => {}) =>
  renderUi(
    <RequiredTroopsSection
      troops={requiredTroops(armyList, selection, costs)}
      troopTypeNames={names}
      troopTypeFactors={factors}
      troopTypeProfiles={profiles}
      onStandsChange={onStandsChange}
    />,
  );

const card = (heading: string) => {
  const found = screen
    .getByRole('heading', { name: heading, level: 3 })
    .closest('li');
  if (!found) {
    throw new Error(`the ${heading} option is not inside a list item`);
  }
  return within(found);
};

describe('RequiredTroopsSection', () => {
  it('names an option by the troop types it offers', () => {
    show();

    expect(
      screen.getByRole('heading', { name: 'Spear', level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Archers or Bow Levy', level: 3 }),
    ).toBeInTheDocument();
  });

  it('shows the bounds and the battle line of every option', () => {
    show();

    expect(card('Spear').getByText(/^0 of 2–6 stands/)).toBeInTheDocument();
    expect(card('Spear').getByText('Battle line')).toBeInTheDocument();
    expect(card('Knights').getByText('Half battle line')).toBeInTheDocument();
    expect(
      card('Archers or Bow Levy').getByText('Not battle line'),
    ).toBeInTheDocument();
  });

  it('prints what a stand costs', () => {
    show();

    expect(card('Spear').getByText('4 points per stand')).toBeInTheDocument();
  });

  it('adds the subtotal once an option holds stands', () => {
    show(withStands(empty, spearmen, 'SPR', 3));

    expect(
      card('Spear').getByText('4 points per stand · 12 points'),
    ).toBeInTheDocument();
  });

  it('says how many stands an option is short of its minimum', () => {
    show();

    expect(
      card('Spear').getByText(/2 more to reach the minimum/),
    ).toBeInTheDocument();
  });

  it('stops saying so once the minimum is reached', () => {
    show(withStands(empty, spearmen, 'SPR', 2));

    expect(
      card('Spear').queryByText(/to reach the minimum/),
    ).not.toBeInTheDocument();
  });

  it('counts a filled option and totals the section', () => {
    show(withStands(empty, spearmen, 'SPR', 3));

    expect(card('Spear').getByText('3 of 2–6 stands')).toBeInTheDocument();
    expect(
      screen.getByText(/^3 stands · 12 points from required troops/),
    ).toBeInTheDocument();
  });

  it('says a multi-type option shares one total', () => {
    show();

    expect(
      card('Archers or Bow Levy').getByText(
        'Any mix of these types, under one shared total.',
      ),
    ).toBeInTheDocument();
  });

  it('offers a stepper per troop entry, named after the troop type', () => {
    show();

    expect(
      card('Spear').getByRole('button', { name: 'One more Spear stand' }),
    ).toBeInTheDocument();
    expect(
      card('Archers or Bow Levy').getByRole('button', {
        name: 'One fewer Bow Levy stand',
      }),
    ).toBeInTheDocument();
    expect(
      card('Archers or Bow Levy').getByLabelText('Archers stands'),
    ).toBeInTheDocument();
  });

  it('reports the stands a stepper asks for', async () => {
    const onStandsChange = vi.fn();
    const { user } = show(empty, list, onStandsChange);

    await user.click(
      card('Spear').getByRole('button', { name: 'One more Spear stand' }),
    );

    expect(onStandsChange).toHaveBeenCalledWith(spearmen, 'SPR', 1);
  });

  it('names only a multi-type option’s steppers after their troop type', () => {
    show();

    expect(card('Spear').queryByText('Spear', { selector: 'p' })).toBeNull();
    expect(
      card('Archers or Bow Levy').getByText('Archers', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(
      card('Archers or Bow Levy').getByText('Bow Levy', { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('offers the factors of every troop type an option holds', () => {
    show();

    expect(
      card('Spear').getByRole('button', { name: 'Spear factors' }),
    ).toBeInTheDocument();
    expect(
      card('Archers or Bow Levy').getByRole('button', {
        name: 'Archers factors',
      }),
    ).toBeInTheDocument();
    expect(
      card('Archers or Bow Levy').getByRole('button', {
        name: 'Bow Levy factors',
      }),
    ).toBeInTheDocument();
  });

  it('shows a troop type’s movement, combat factors and basing on a tap', async () => {
    const { user } = show();

    await user.click(
      card('Spear').getByRole('button', { name: 'Spear factors' }),
    );

    const factors = within(
      await screen.findByRole('dialog', { name: 'Spear' }),
    );
    const terms = factors.getAllByRole('term').map((term) => term.textContent);
    const values = factors
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(
      Object.fromEntries(terms.map((term, i) => [term, values[i]])),
    ).toEqual({
      Move: '3',
      'v Foot': '4',
      'v Mtd': '4',
      Shoot: '0',
      'Shot at': '3',
      'Base (mm)': '40×15 · 60×20 · 80×30',
      Figures: '4 per stand',
    });
  });

  it('shows a dash for the movement and basing the data does not give', async () => {
    const { user } = renderUi(
      <RequiredTroopsSection
        troops={requiredTroops(list, empty, costs)}
        troopTypeNames={names}
        troopTypeFactors={factors}
        troopTypeProfiles={troopTypeProfiles(unmeasuredTroopTypes)}
        onStandsChange={() => {}}
      />,
    );

    await user.click(
      card('Spear').getByRole('button', { name: 'Spear factors' }),
    );

    const popover = within(
      await screen.findByRole('dialog', { name: 'Spear' }),
    );
    const terms = popover.getAllByRole('term').map((term) => term.textContent);
    const values = popover
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(
      Object.fromEntries(terms.map((term, i) => [term, values[i]])),
    ).toMatchObject({ Move: '—', 'Base (mm)': '—', Figures: '—' });
  });

  it('says a troop type’s order and what a stand of it costs', async () => {
    const { user } = show();

    await user.click(
      card('Spear').getByRole('button', { name: 'Spear factors' }),
    );
    expect(
      within(await screen.findByRole('dialog', { name: 'Spear' })).getByText(
        'Close order foot · 4 points per stand',
      ),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(
      card('Archers or Bow Levy').getByRole('button', {
        name: 'Bow Levy factors',
      }),
    );
    expect(
      within(await screen.findByRole('dialog', { name: 'Bow Levy' })).getByText(
        'Open order foot · 2 points per stand',
      ),
    ).toBeInTheDocument();
  });

  it('says when a stand holds a range of figures or a model and its crew', async () => {
    const { user } = show(
      empty,
      buildArmyList(
        armyDetail({
          troopOptions: [troopOption({ troopEntries: entries('HRD', 'ELE') })],
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Horde factors' }));
    expect(
      within(await screen.findByRole('dialog', { name: 'Horde' })).getByText(
        '7 or 8 per stand',
      ),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Elephants factors' }));
    const elephants = within(
      await screen.findByRole('dialog', { name: 'Elephants' }),
    );
    expect(elephants.getByText('1 model plus crew')).toBeInTheDocument();
    expect(elephants.getByText('40×40 · 60×60 · 80×80')).toBeInTheDocument();
  });

  it('shows a troop type’s factors on hover', async () => {
    const { user } = show();

    await user.hover(
      card('Spear').getByRole('button', { name: 'Spear factors' }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Spear' }),
    ).toBeInTheDocument();
  });

  it('opens the factors from the keyboard and closes them on Escape', async () => {
    const { user } = show();
    const trigger = card('Archers or Bow Levy').getByRole('button', {
      name: 'Archers factors',
    });

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('dialog', { name: 'Archers' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Archers' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('closes the factors on a tap outside them', async () => {
    const { user } = show();

    await user.click(
      card('Spear').getByRole('button', { name: 'Spear factors' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Spear' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('heading', { name: 'Knights', level: 3 }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Spear' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('disables removing from an empty option', () => {
    show();

    expect(
      card('Spear').getByRole('button', { name: 'One fewer Spear stand' }),
    ).toBeDisabled();
    expect(
      card('Spear').getByRole('button', { name: 'One more Spear stand' }),
    ).toBeEnabled();
  });

  it('disables adding to a full option', () => {
    show(withStands(empty, spearmen, 'SPR', 6));

    expect(
      card('Spear').getByRole('button', { name: 'One more Spear stand' }),
    ).toBeDisabled();
    expect(
      card('Spear').getByRole('button', { name: 'One fewer Spear stand' }),
    ).toBeEnabled();
  });

  it('marks an option past its maximum', () => {
    show(withStands(empty, spearmen, 'SPR', 8));

    expect(card('Spear').getByText(/2 over the maximum/)).toBeInTheDocument();
  });

  it('keeps a withheld option that still holds stands, and says why', () => {
    show(withStands({ ...empty, year: -2850 }, archers, 'ARC', 2));

    const withheld = card('Archers or Bow Levy');
    expect(withheld.getByText('Not offered in this year')).toBeInTheDocument();
    expect(
      withheld.getByRole('button', { name: 'One more Archers stand' }),
    ).toBeDisabled();
    expect(
      withheld.getByRole('button', { name: 'One fewer Archers stand' }),
    ).toBeEnabled();
  });

  it('counts the options the gating withholds', () => {
    show({ ...empty, variant: null });

    expect(
      screen.getByText(/1 option withheld by the year or the sub-faction/),
    ).toBeInTheDocument();
  });

  it('says so when no option is available at all', () => {
    show({ ...empty, year: -2850 }, datedList);

    expect(
      screen.getByText(
        'No troop options are available at this year and sub-faction.',
      ),
    ).toBeInTheDocument();
  });
});
