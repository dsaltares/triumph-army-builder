import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GeneralSection } from '@/components/builder/general';
import {
  type ArmyList,
  buildArmyList,
  type ContingentGroup,
  type TroopOption,
} from '@/lib/domain/army/army-list';
import { generalChoice } from '@/lib/domain/army/general-selection';
import {
  type ArmySelection,
  emptySelection,
  type StandRef,
  withAllyTroopOption,
  withContingentGroup,
  withGeneral,
  withStands,
} from '@/lib/domain/army/selection';
import { troopTypeNames } from '@/lib/domain/troop-types';
import {
  allyContingent,
  armyDetail,
  entries,
  troopOption,
} from '@/test/fixtures/army';
import { sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const names = troopTypeNames(sampleTroopTypes);

const list = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({ description: 'Palace guard' }),
      troopOption({ min: 0, max: 4, troopEntries: entries('ARC') }),
      troopOption({ min: 0, max: 2, troopEntries: entries('KNT') }),
    ],
  }),
);

const withAlliedSpear = buildArmyList(
  armyDetail({
    allyOptions: [
      {
        allyEntries: [
          { allyArmyList: 'contingent-ally', name: 'Allied horse' },
        ],
        dateRange: null,
        note: null,
      },
    ],
    allyContingents: [
      allyContingent({
        id: 'contingent-ally',
        name: 'Fixture Allied Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 2, max: 4, troopEntries: entries('SPR') }),
        ],
      }),
    ],
  }),
);

const optionAt = (
  troopOptions: readonly TroopOption[],
  index: number,
): TroopOption => {
  const option = troopOptions[index];
  if (!option) {
    throw new Error(`the fixture army no longer has troop option ${index}`);
  }
  return option;
};

const guard = optionAt(list.main.troopOptions, 0);
const bowmen = optionAt(list.main.troopOptions, 1);
const knights = optionAt(list.main.troopOptions, 2);

const groupOf = (armyList: ArmyList): ContingentGroup => {
  const [group] = armyList.contingentGroups;
  if (!group) {
    throw new Error('the fixture army no longer offers a contingent');
  }
  return group;
};

const emptyOf = (armyList: ArmyList): ArmySelection =>
  emptySelection({
    army: armyList.id,
    dataVersion: '2026-09-17.abcdef01',
    year: -2950,
  });

const empty = emptyOf(list);

const show = (
  selection = empty,
  armyList = list,
  onGeneralChange: (general: StandRef | null) => void = () => {},
) =>
  renderUi(
    <GeneralSection
      choice={generalChoice(armyList, selection)}
      troopTypeNames={names}
      onGeneralChange={onGeneralChange}
    />,
  );

const section = () => {
  const found = screen
    .getByRole('heading', { name: 'General', level: 2 })
    .closest('section');
  if (!found) {
    throw new Error('the General heading is not inside a section');
  }
  return within(found);
};

const candidate = (label: string) =>
  section().getByRole('button', { name: label });

describe('GeneralSection', () => {
  it('says which troop types lead this list', () => {
    show();

    expect(
      section().getByText(/This list is led by Spear or Knights/),
    ).toBeInTheDocument();
  });

  it('waits for the army to hold a stand it can lead with', () => {
    show();

    expect(
      section().getByText(
        /The army has no stands yet\. Take Spear or Knights in Required Troops/,
      ),
    ).toBeInTheDocument();
  });

  it('offers a stand of every troop type the list allows, none named yet', () => {
    show(withStands(withStands(empty, guard, 'SPR', 3), knights, 'KNT', 2));

    expect(candidate('Spear from Palace guard')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(candidate('Knights from Required Troops')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      section().getByText(/5 of 5 stands can lead the army/),
    ).toBeInTheDocument();
    expect(
      section().getByText(/no stand named the general yet/),
    ).toBeInTheDocument();
  });

  it('leaves out the stands the list does not draw a general from', () => {
    show(withStands(withStands(empty, guard, 'SPR', 2), bowmen, 'ARC', 4));

    expect(
      section().queryByRole('button', { name: /^Archers from/ }),
    ).not.toBeInTheDocument();
    expect(
      section().getByText(/2 of 6 stands can lead the army/),
    ).toBeInTheDocument();
  });

  it('says so when nothing the army has taken can lead it', () => {
    show(withStands(empty, bowmen, 'ARC', 4));

    expect(
      section().getByText(
        /None of the stands taken can lead the army.*from the main army or an optional contingent/,
      ),
    ).toBeInTheDocument();
  });

  it('marks the stand the army is led by', () => {
    show(
      withGeneral(withStands(empty, guard, 'SPR', 3), {
        option: guard.id,
        troopType: 'SPR',
      }),
    );

    expect(candidate('Spear from Palace guard')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      section().getByText('General', { selector: 'span' }),
    ).toBeInTheDocument();
    expect(
      section().getByText(/the general is Spear from Palace guard/),
    ).toBeInTheDocument();
  });

  it('names an unnamed stand the general', async () => {
    const onGeneralChange = vi.fn();
    const { user } = show(
      withStands(empty, guard, 'SPR', 3),
      list,
      onGeneralChange,
    );

    await user.click(candidate('Spear from Palace guard'));

    expect(onGeneralChange).toHaveBeenCalledWith({
      option: guard.id,
      troopType: 'SPR',
    });
  });

  it('stands the named general down again', async () => {
    const onGeneralChange = vi.fn();
    const { user } = show(
      withGeneral(withStands(empty, guard, 'SPR', 3), {
        option: guard.id,
        troopType: 'SPR',
      }),
      list,
      onGeneralChange,
    );

    await user.click(candidate('Spear from Palace guard'));

    expect(onGeneralChange).toHaveBeenCalledWith(null);
  });

  it('names the contingent a stand outside Required Troops comes from', () => {
    const withFriends = buildArmyList(
      armyDetail({
        allyOptions: [
          {
            allyEntries: [
              { allyArmyList: 'contingent-optional', name: 'Optional friends' },
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
                description: 'Household knights',
                troopEntries: entries('KNT'),
              }),
            ],
          }),
        ],
      }),
    );
    const group = groupOf(withFriends);
    const option = optionAt(group.contingents[0].troopOptions, 0);

    show(
      withStands(
        withContingentGroup(emptyOf(withFriends), group),
        option,
        'KNT',
        2,
      ),
      withFriends,
    );

    expect(
      candidate(
        'Knights from Household knights in Fixture Optional Contingent',
      ),
    ).toBeInTheDocument();
  });

  it('reports a general of a troop type the list does not allow', () => {
    show(
      withGeneral(withStands(empty, bowmen, 'ARC', 4), {
        option: bowmen.id,
        troopType: 'ARC',
      }),
    );

    expect(candidate('Archers from Required Troops')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      section().getByText(
        /The general is a stand of Archers, and this list is led by Spear or Knights/,
      ),
    ).toBeInTheDocument();
    expect(
      section().getByText(/0 of 4 stands can lead the army/),
    ).toBeInTheDocument();
  });

  it('reports a general the army may not be led by', () => {
    const group = groupOf(withAlliedSpear);
    const option = optionAt(group.contingents[0].troopOptions, 0);

    show(
      withGeneral(
        withStands(
          withAllyTroopOption(withAlliedSpear, emptyOf(withAlliedSpear), group),
          option,
          'SPR',
          2,
        ),
        { option: option.id, troopType: 'SPR' },
      ),
      withAlliedSpear,
    );

    expect(
      section().getByText(
        /The general is a stand of Fixture Allied Contingent, an allied contingent/,
      ),
    ).toBeInTheDocument();
    expect(
      section().getByText(/0 of 2 stands can lead the army/),
    ).toBeInTheDocument();
  });
});
