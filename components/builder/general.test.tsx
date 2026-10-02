import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  GeneralChip,
  GeneralStandBadge,
  GeneralStandNotice,
  GeneralStandToggle,
  GeneralToggleProvider,
} from '@/components/builder/general';
import type { TroopTypeCode } from '@/lib/data/schema';
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

const chip = (label: string | RegExp = / — show general$/) =>
  screen.getByRole('button', { name: label });

const render = (
  selection = empty,
  armyList = list,
  onGeneralChange: (general: StandRef | null) => void = () => {},
) =>
  renderUi(
    <GeneralChip
      choice={generalChoice(armyList, selection)}
      troopTypeNames={names}
      onGeneralChange={onGeneralChange}
    />,
  );

const show = async (...args: Parameters<typeof render>) => {
  const rendered = render(...args);
  await rendered.user.click(chip());
  return rendered;
};

const section = () => within(screen.getByRole('dialog'));

const candidate = (label: string) =>
  section().getByRole('button', { name: label });

const showRow = (
  selection: ArmySelection,
  option: TroopOption,
  troopType: TroopTypeCode,
  onGeneralChange: (general: StandRef | null) => void = () => {},
  armyList = list,
) =>
  renderUi(
    <GeneralToggleProvider
      choice={generalChoice(armyList, selection)}
      troopTypeNames={names}
      onGeneralChange={onGeneralChange}
    >
      <GeneralStandToggle
        option={option}
        troopType={troopType}
        name={names[troopType]}
      />
      <GeneralStandBadge option={option} troopType={troopType} />
      <GeneralStandNotice option={option} />
    </GeneralToggleProvider>,
  );

describe('GeneralChip', () => {
  it('says no stand leads the army yet', () => {
    render();

    expect(chip('No general yet — show general')).toHaveTextContent(
      'No general',
    );
  });

  it('names the troop type the army is led by', () => {
    render(
      withGeneral(withStands(empty, guard, 'SPR', 3), {
        option: guard.id,
        troopType: 'SPR',
      }),
    );

    expect(chip('General: Spear — show general')).toHaveTextContent('Spear');
  });

  it('opens when a finding about the general is followed', async () => {
    const { user } = renderUi(
      <>
        <a href="#general">One stand in the army must be the general</a>
        <GeneralChip
          choice={generalChoice(list, empty)}
          troopTypeNames={names}
          onGeneralChange={() => {}}
        />
      </>,
    );

    await user.click(
      screen.getByRole('link', {
        name: 'One stand in the army must be the general',
      }),
    );

    expect(
      section().getByText(/This list is led by Spear or Knights/),
    ).toBeInTheDocument();
  });

  it('says which troop types lead this list, and how to name one', async () => {
    await show();

    expect(
      section().getByText(/This list is led by Spear or Knights/),
    ).toBeInTheDocument();
    expect(
      section().getByText(/Name it with the crown beside one of its stands/),
    ).toBeInTheDocument();
  });

  it('waits for the army to hold a stand it can lead with', async () => {
    await show();

    expect(
      section().getByText(
        /The army has no stands yet\. Take Spear or Knights in Required Troops/,
      ),
    ).toBeInTheDocument();
  });

  it('offers a stand of every troop type the list allows, none named yet', async () => {
    await show(
      withStands(withStands(empty, guard, 'SPR', 3), knights, 'KNT', 2),
    );

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

  it('leaves out the stands the list does not draw a general from', async () => {
    await show(
      withStands(withStands(empty, guard, 'SPR', 2), bowmen, 'ARC', 4),
    );

    expect(
      section().queryByRole('button', { name: /^Archers from/ }),
    ).not.toBeInTheDocument();
    expect(
      section().getByText(/2 of 6 stands can lead the army/),
    ).toBeInTheDocument();
  });

  it('says so when nothing the army has taken can lead it', async () => {
    await show(withStands(empty, bowmen, 'ARC', 4));

    expect(
      section().getByText(
        /None of the stands taken can lead the army.*from the main army or an optional contingent/,
      ),
    ).toBeInTheDocument();
  });

  it('marks the stand the army is led by', async () => {
    await show(
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
    const { user } = await show(
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
    const { user } = await show(
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

  it('names the contingent a stand outside Required Troops comes from', async () => {
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

    await show(
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

  it('reports a general of a troop type the list does not allow', async () => {
    await show(
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

  it('reports a general the army may not be led by', async () => {
    const group = groupOf(withAlliedSpear);
    const option = optionAt(group.contingents[0].troopOptions, 0);

    await show(
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

describe('GeneralStandToggle', () => {
  it('offers a stand the army can be led by', () => {
    showRow(withStands(empty, guard, 'SPR', 3), guard, 'SPR');

    expect(
      screen.getByRole('button', { name: 'Spear as general' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers nothing on a stand the list draws no general from', () => {
    showRow(withStands(empty, bowmen, 'ARC', 4), bowmen, 'ARC');

    expect(
      screen.queryByRole('button', { name: /as general/ }),
    ).not.toBeInTheDocument();
  });

  it('offers nothing until the option holds a stand', () => {
    showRow(empty, guard, 'SPR');

    expect(
      screen.queryByRole('button', { name: /as general/ }),
    ).not.toBeInTheDocument();
  });

  it('names the stand the general, and stands it down again', async () => {
    const onGeneralChange = vi.fn();
    const named = withGeneral(withStands(empty, guard, 'SPR', 3), {
      option: guard.id,
      troopType: 'SPR',
    });
    const { user, unmount } = showRow(
      withStands(empty, guard, 'SPR', 3),
      guard,
      'SPR',
      onGeneralChange,
    );

    await user.click(screen.getByRole('button', { name: 'Spear as general' }));

    expect(screen.queryByText('General')).not.toBeInTheDocument();
    expect(onGeneralChange).toHaveBeenLastCalledWith({
      option: guard.id,
      troopType: 'SPR',
    });

    unmount();
    showRow(named, guard, 'SPR', onGeneralChange);
    const toggle = screen.getByRole('button', { name: 'Spear as general' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('General')).toBeInTheDocument();

    await user.click(toggle);

    expect(onGeneralChange).toHaveBeenLastCalledWith(null);
  });

  it('says why a stand that cannot lead is no general', () => {
    showRow(
      withGeneral(withStands(empty, bowmen, 'ARC', 4), {
        option: bowmen.id,
        troopType: 'ARC',
      }),
      bowmen,
      'ARC',
    );

    expect(
      screen.getByRole('button', { name: 'Archers as general' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText(
        /The general is a stand of Archers, and this list is led by Spear or Knights/,
      ),
    ).toBeInTheDocument();
  });
});
