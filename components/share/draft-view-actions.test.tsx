import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftViewActions } from '@/components/share/draft-view-actions';
import { listArmies } from '@/lib/db/armies';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { withStands } from '@/lib/domain/army/selection';
import { draftView } from '@/lib/domain/army/shared-view';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army';
import { router } from '@/test/next-navigation';
import { sampleBattleCards, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'user-hannibal';

const troopTypes = sampleTroopTypes;

const armyList = buildArmyList(armyDetail());

const spearmen = armyList.main.troopOptions[0];
if (!spearmen) {
  throw new Error('the fixture army no longer has a first troop option');
}

const selection = withStands(fixtureSelection(), spearmen, 'SPR', 6);

const { list, sheet, collection } = draftView({
  selection,
  collection: [],
  armyList,
  troopTypes,
  battleCards: sampleBattleCards,
});

const open = () =>
  renderUi(
    <DraftViewActions list={list} sheet={sheet} collection={collection} />,
    { wrap: api.wrap },
  );

beforeEach(async () => {
  vi.setSystemTime(new Date(2026, 8, 24, 9, 30));
  asSignedIn({ id: owner });
  await api.signIn(owner);
  router.push.mockClear();
});

describe('DraftViewActions', () => {
  it('saves nothing until the player asks to edit the list', async () => {
    open();

    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(await listArmies(api.database(), owner)).toEqual([]);
  });

  it('keeps the list, named for the army and the day, and opens it in the builder', async () => {
    const { user } = open();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/triumph/build?list=army-1`),
    );
    const [created, ...others] = await listArmies(api.database(), owner);
    expect(others).toEqual([]);
    expect(created?.name).toBe(`${armyList.name} · 24 September 2026`);
    expect(created?.selection).toEqual(selection);
  });
});
