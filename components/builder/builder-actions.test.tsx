import { screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderMenu } from '@/components/builder/builder-actions';
import type { BuilderSnapshot } from '@/components/builder/builder-state';
import { Toaster } from '@/components/ui/sonner';
import { type ArmyList, buildArmyList } from '@/lib/domain/army/army-list';
import {
  type ArmySelection,
  emptySelection,
} from '@/lib/domain/army/selection';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeMovements,
  troopTypeNames,
} from '@/lib/domain/troop-types';
import { serveApi } from '@/test/api';
import {
  armyDetail,
  entries,
  fixtureDataVersion,
  troopOption,
} from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const troopTypes = sampleTroopTypes;

const leaderless = buildArmyList(
  armyDetail({
    troopOptions: [troopOption({ min: 2, max: 12 })],
    troopEntriesForGeneral: [{ troopEntries: entries('ELE') }],
    allyOptions: [],
    allyContingents: [],
  }),
);

const tooSmall = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({ min: 2, max: 3, troopEntries: entries('SPR') }),
    ],
    troopEntriesForGeneral: [{ troopEntries: entries('SPR') }],
    battleCardEntries: [],
    allyOptions: [],
    allyContingents: [],
  }),
);

const openMenu = async (armyList: ArmyList) => {
  const replaceSelection = vi.fn<(selection: ArmySelection) => void>();
  const builder: BuilderSnapshot = {
    dataVersion: fixtureDataVersion,
    armyList,
    listName: armyList.name,
    rename: () => {},
    selection: emptySelection({
      army: armyList.id,
      dataVersion: fixtureDataVersion,
      year: armyList.dateRange.startDate,
    }),
    replaceSelection,
    costs: {
      troopTypes: troopTypeCosts(troopTypes),
      battleCards: sampleBattleCardCosts,
    },
    names: troopTypeNames(troopTypes),
    factors: troopTypeFactors(troopTypes),
    movement: troopTypeMovements(troopTypes),
    saved: null,
  };
  const view = renderUi(
    <>
      <BuilderMenu snapshot={builder} view={null} />
      <Toaster />
    </>,
    { wrap: api.wrap },
  );
  await view.user.click(screen.getByRole('button', { name: 'List actions' }));
  return { ...view, replaceSelection };
};

afterEach(() => {
  toast.dismiss();
});

describe('BuilderMenu', () => {
  it('gathers the list actions and the exports under one button', async () => {
    await openMenu(leaderless);

    expect(
      screen.getAllByRole('menuitem').map(({ textContent }) => textContent),
    ).toEqual([
      'Randomize',
      'Can I build it?',
      'Share link',
      'Copy as text…',
      'Preview PDF',
      'Download PDF',
    ]);
  });

  it('says so and changes nothing when no stand may be the general', async () => {
    const { user, replaceSelection } = await openMenu(leaderless);

    await user.click(screen.getByRole('menuitem', { name: 'Randomize' }));

    expect(
      await screen.findByText(
        'No random list to draw: in this year no stand the army has may be its general',
      ),
    ).toBeInTheDocument();
    expect(replaceSelection).not.toHaveBeenCalled();
  });

  it('names the closest total when the cap cannot be reached', async () => {
    const { user, replaceSelection } = await openMenu(tooSmall);

    await user.click(screen.getByRole('menuitem', { name: 'Randomize' }));

    expect(
      await screen.findByText(
        'No random list to draw: in this year the army reaches 12 of 48 points at most',
      ),
    ).toBeInTheDocument();
    expect(replaceSelection).not.toHaveBeenCalled();
  });
});
