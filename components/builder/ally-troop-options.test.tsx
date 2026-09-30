import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AllyTroopOptionsSection } from '@/components/builder/ally-troop-options';
import {
  allyTroopOptionGroups,
  buildArmyList,
  type ContingentGroup,
  type TroopOption,
} from '@/lib/domain/army/army-list';
import { allyTroopOptions } from '@/lib/domain/army/contingent-selection';
import {
  emptySelection,
  withAllyTroopOption,
  withStands,
} from '@/lib/domain/army/selection';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeNames,
  troopTypeProfiles,
} from '@/lib/domain/troop-types';
import { armyDetail, contingentArmyDetail } from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const troopTypes = sampleTroopTypes;
const costs = {
  troopTypes: troopTypeCosts(troopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(troopTypes);
const factors = troopTypeFactors(troopTypes);
const profiles = troopTypeProfiles(troopTypes);

const list = buildArmyList(contingentArmyDetail());
const withoutAllies = buildArmyList(
  armyDetail({ allyOptions: [], allyContingents: [] }),
);

const allyNamed = (name: string): ContingentGroup => {
  const group = allyTroopOptionGroups(list).find(
    (candidate) => candidate.name === name,
  );
  if (!group) {
    throw new Error(`the fixture army no longer offers ${name}`);
  }
  return group;
};

const horse = allyNamed('Allied horse');
const foot = allyNamed('Allied foot');
const pair = allyNamed('Northern allies and Southern allies');
const lateAllies = allyNamed('Late allies');

const optionOf = (group: ContingentGroup, index: number): TroopOption => {
  const option = group.contingents[0].troopOptions[index];
  if (!option) {
    throw new Error(`${group.name} no longer has the option the tests need`);
  }
  return option;
};

const horseBow = optionOf(horse, 0);

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2950,
});

const show = (selection = empty, armyList = list, onChoose = () => {}) =>
  renderUi(
    <AllyTroopOptionsSection
      allies={allyTroopOptions(armyList, selection, costs)}
      troopTypeNames={names}
      troopTypeFactors={factors}
      troopTypeProfiles={profiles}
      onChoose={onChoose}
      onStandsChange={() => {}}
    />,
  );

const choice = (name: string) => {
  const found = screen.getByRole('radio', { name }).closest('li');
  if (!found) {
    throw new Error(`the ${name} choice is not inside a list item`);
  }
  return within(found);
};

describe('AllyTroopOptionsSection', () => {
  it('names every ally the year offers, and what it brings', () => {
    show();

    expect(
      screen.getByRole('radio', { name: 'Allied horse' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Allied foot' }),
    ).toBeInTheDocument();
    expect(
      choice('Allied horse').getByText('Brings 2–4 Horse Bow'),
    ).toBeInTheDocument();
  });

  it('leaves the optional contingents out', () => {
    show();

    expect(
      screen.queryByRole('radio', { name: 'Optional friends' }),
    ).not.toBeInTheDocument();
  });

  it('offers taking no ally at all, chosen until one is taken', () => {
    show();

    expect(
      screen.getByRole('radio', { name: 'No allied contingent' }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Allied horse' }),
    ).not.toBeChecked();
  });

  it('marks the ally that has been taken', () => {
    show(withAllyTroopOption(list, empty, horse));

    expect(screen.getByRole('radio', { name: 'Allied horse' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'No allied contingent' }),
    ).not.toBeChecked();
  });

  it('reports the ally a player picks', async () => {
    const onChoose = vi.fn();
    const { user } = show(empty, list, onChoose);

    await user.click(screen.getByRole('radio', { name: 'Allied horse' }));

    expect(onChoose).toHaveBeenCalledWith(horse);
  });

  it('keeps the troop options out of sight until an ally is taken', () => {
    show();

    expect(
      screen.queryByRole('button', { name: 'One more Horse Bow stand' }),
    ).not.toBeInTheDocument();
  });

  it("applies the ally's own bounds once it is taken", () => {
    show(withAllyTroopOption(list, empty, horse));

    const taken = choice('Allied horse');
    expect(taken.getByText(/^0 of 2–4 stands/)).toBeInTheDocument();
    expect(
      taken.getByRole('button', { name: 'One more Horse Bow stand' }),
    ).toBeEnabled();
  });

  it('marks the stands an ally brings as allied', () => {
    show(withAllyTroopOption(list, empty, horse));

    const taken = choice('Allied horse');
    expect(taken.getByText('Fixture Allied Contingent')).toBeInTheDocument();
    expect(taken.getByText('Allied stands')).toBeInTheDocument();
  });

  it('counts the stands and the points of the ally', () => {
    show(
      withStands(withAllyTroopOption(list, empty, horse), horseBow, 'HBW', 2),
    );

    expect(
      choice('Allied horse').getByText('2 stands · 8 points'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Allied horse · 2 stands · 8 points from the ally/),
    ).toBeInTheDocument();
  });

  it('holds only one ally at a time', () => {
    show(
      withAllyTroopOption(list, withAllyTroopOption(list, empty, horse), foot),
    );

    expect(
      screen.getByText(/^Allied foot · 0 stands · 0 points from the ally/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'One more Horse Bow stand' }),
    ).not.toBeInTheDocument();
  });

  it('says a pair comes together and still spends one slot, and names both', () => {
    show(withAllyTroopOption(list, empty, pair));

    const taken = choice('Northern allies and Southern allies');
    expect(
      taken.getByText(
        /Both come together.*spends the one ally slot between them/,
      ),
    ).toBeInTheDocument();
    expect(taken.getByText('Fixture Northern Contingent')).toBeInTheDocument();
    expect(taken.getByText('Fixture Southern Contingent')).toBeInTheDocument();
  });

  it('counts the allies the year withholds', () => {
    show();

    expect(
      screen.getByText(/1 ally not offered in this year/),
    ).toBeInTheDocument();
  });

  it('carries the years and the note of the ally option', () => {
    show({ ...empty, year: -2850 });

    expect(screen.getByText('2900–2800 BC')).toBeInTheDocument();
    expect(screen.getByText('taken together')).toBeInTheDocument();
  });

  it('keeps a taken ally the year has moved away from, unfillable', () => {
    const taken = withStands(
      withAllyTroopOption(list, { ...empty, year: -2850 }, lateAllies),
      optionOf(lateAllies, 0),
      'KNT',
      1,
    );

    show({ ...taken, year: -2950 });

    const stranded = choice('Late allies');
    expect(stranded.getByText('Not offered in this year')).toBeInTheDocument();
    expect(
      stranded.getByRole('button', { name: 'One more Knights stand' }),
    ).toBeDisabled();
    expect(
      stranded.getByRole('button', { name: 'One fewer Knights stand' }),
    ).toBeEnabled();
  });

  it('says so when the year offers none of them', () => {
    const onlyLate = buildArmyList({
      ...contingentArmyDetail(),
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-late-ally', name: 'Late allies' },
          ],
          dateRange: { startDate: -2900, endDate: -2800 },
          note: null,
        },
      ],
    });

    show(empty, onlyLate);

    expect(
      screen.getByText('No ally troop option is offered in this year.'),
    ).toBeInTheDocument();
  });

  it('draws nothing at all for an army that is offered none', () => {
    const { container } = show(empty, withoutAllies);

    expect(container).toBeEmptyDOMElement();
  });
});
