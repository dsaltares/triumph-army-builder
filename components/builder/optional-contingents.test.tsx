import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptionalContingentsSection } from '@/components/builder/optional-contingents';
import {
  buildArmyList,
  type ContingentGroup,
  optionalContingentGroups,
  type TroopOption,
} from '@/lib/domain/army/army-list';
import { optionalContingents } from '@/lib/domain/army/contingent-selection';
import {
  emptySelection,
  withContingentGroup,
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
const withoutContingents = buildArmyList(
  armyDetail({ allyOptions: [], allyContingents: [] }),
);

const groupNamed = (name: string): ContingentGroup => {
  const group = optionalContingentGroups(list).find(
    (candidate) => candidate.name === name,
  );
  if (!group) {
    throw new Error(`the fixture army no longer offers ${name}`);
  }
  return group;
};

const friends = groupNamed('Optional friends');
const levies = groupNamed('Hill levy and River levy');

const optionOf = (group: ContingentGroup, index: number): TroopOption => {
  const option = group.contingents[0].troopOptions[index];
  if (!option) {
    throw new Error(`${group.name} no longer has the option the tests need`);
  }
  return option;
};

const lightFoot = optionOf(friends, 0);

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2950,
});

const show = (selection = empty, armyList = list, onToggle = () => {}) =>
  renderUi(
    <OptionalContingentsSection
      contingents={optionalContingents(armyList, selection, costs)}
      troopTypeNames={names}
      troopTypeFactors={factors}
      troopTypeProfiles={profiles}
      onToggle={onToggle}
      onStandsChange={() => {}}
    />,
  );

const card = (name: string) => {
  const found = screen.getByRole('switch', { name }).closest('li');
  if (!found) {
    throw new Error(`the ${name} contingent is not inside a list item`);
  }
  return within(found);
};

describe('OptionalContingentsSection', () => {
  it('names every contingent the year offers, and what it brings', () => {
    show();

    expect(
      card('Optional friends').getByText('Brings 1–2 Light Foot'),
    ).toBeInTheDocument();
    expect(
      card('Hill levy and River levy').getByText(/0–2 Rabble/),
    ).toBeInTheDocument();
  });

  it('leaves the ally troop options out', () => {
    show();

    expect(
      screen.queryByRole('switch', { name: 'Allied horse' }),
    ).not.toBeInTheDocument();
  });

  it('offers a switch per contingent, off until it is taken', () => {
    show();

    expect(
      screen.getByRole('switch', { name: 'Optional friends' }),
    ).not.toBeChecked();
  });

  it('marks a taken contingent', () => {
    show(withContingentGroup(empty, friends));

    expect(
      screen.getByRole('switch', { name: 'Optional friends' }),
    ).toBeChecked();
  });

  it('reports the contingent a player takes', async () => {
    const onToggle = vi.fn();
    const { user } = show(empty, list, onToggle);

    await user.click(screen.getByRole('switch', { name: 'Optional friends' }));

    expect(onToggle).toHaveBeenCalledWith(friends, true);
  });

  it('keeps the troop options out of sight until the contingent is taken', () => {
    show();

    expect(
      screen.queryByRole('button', { name: 'One more Light Foot stand' }),
    ).not.toBeInTheDocument();
  });

  it("applies the contingent's own bounds once taken", () => {
    show(withContingentGroup(empty, friends));

    const taken = card('Optional friends');
    expect(taken.getByText(/^0 of 1–2 stands/)).toBeInTheDocument();
    expect(
      taken.getByRole('button', { name: 'One more Light Foot stand' }),
    ).toBeEnabled();
  });

  it('counts the stands and the points of a taken contingent', () => {
    show(withStands(withContingentGroup(empty, friends), lightFoot, 'LFT', 2));

    expect(
      card('Optional friends').getByText('2 stands · 6 points'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^1 of 3 taken · 2 stands · 6 points from optional contingents/,
      ),
    ).toBeInTheDocument();
  });

  it('says a pair comes together, and names both', () => {
    show(withContingentGroup(empty, levies));

    const taken = card('Hill levy and River levy');
    expect(taken.getByText(/Both come together/)).toBeInTheDocument();
    expect(taken.getByText('Fixture Hill Contingent')).toBeInTheDocument();
    expect(taken.getByText('Fixture River Contingent')).toBeInTheDocument();
  });

  it('counts the contingents the year withholds', () => {
    show();

    expect(
      screen.getByText(/1 contingent not offered in this year/),
    ).toBeInTheDocument();
  });

  it('carries the years and the note of the ally option', () => {
    show({ ...empty, year: -2850 });

    expect(screen.getByText('2900–2800 BC')).toBeInTheDocument();
    expect(screen.getByText('taken together')).toBeInTheDocument();
  });

  it('keeps a taken contingent the year has moved away from, unfillable', () => {
    const late = groupNamed('Late arrivals');
    const taken = withStands(
      withContingentGroup({ ...empty, year: -2850 }, late),
      optionOf(late, 0),
      'WBD',
      1,
    );

    show({ ...taken, year: -2950 });

    const stranded = card('Late arrivals');
    expect(stranded.getByText('Not offered in this year')).toBeInTheDocument();
    expect(
      stranded.getByRole('button', { name: 'One more Warband stand' }),
    ).toBeDisabled();
    expect(
      stranded.getByRole('button', { name: 'One fewer Warband stand' }),
    ).toBeEnabled();
  });

  it('says so when the year offers none of them', () => {
    const onlyLate = buildArmyList({
      ...contingentArmyDetail(),
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-dated', name: 'Late arrivals' },
          ],
          dateRange: { startDate: -2900, endDate: -2800 },
          note: null,
        },
      ],
    });

    show(empty, onlyLate);

    expect(
      screen.getByText('No optional contingent is offered in this year.'),
    ).toBeInTheDocument();
  });

  it('draws nothing at all for an army that takes none', () => {
    const { container } = show(empty, withoutContingents);

    expect(container).toBeEmptyDOMElement();
  });
});
