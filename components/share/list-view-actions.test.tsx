import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListViewActions } from '@/components/share/list-view-actions';
import { buildArmyList } from '@/lib/domain/army/army-list';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import { withStands } from '@/lib/domain/army/selection';
import { savedView } from '@/lib/domain/army/shared-view';
import { serveApi } from '@/test/api';
import { asAnonymous } from '@/test/auth-client';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army';
import { sampleBattleCards, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'anonymous-hannibal';

const troopTypes = sampleTroopTypes;

const armyList = buildArmyList(armyDetail());

const spearmen = armyList.main.troopOptions[0];
if (!spearmen) {
  throw new Error('the fixture army no longer has a first troop option');
}

const saved: SavedArmy = {
  id: 'saved-1',
  name: 'Cannae',
  armyListId: armyList.id,
  dataVersion: fixtureSelection().dataVersion,
  selection: withStands(fixtureSelection(), spearmen, 'SPR', 6),
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
};

const { sheet, collection } = savedView({
  saved,
  collection: null,
  armyList,
  troopTypes,
  battleCards: sampleBattleCards,
});

const open = () =>
  renderUi(
    <ListViewActions list={saved} sheet={sheet} collection={collection} />,
    {
      wrap: api.wrap,
    },
  );

const dialog = () => within(screen.getByRole('dialog'));

beforeEach(async () => {
  asAnonymous(owner);
  await api.signInAnonymously(owner);
});

describe('ListViewActions', () => {
  it('opens the list in the builder to edit it', () => {
    open();

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/armies/${armyList.id}/build?list=saved-1`,
    );
  });

  it('opens what the collection covers from the menu', async () => {
    const { user } = open();

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Can I build it?' }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Can I build it?' }),
    ).toBeVisible();
  });

  it('offers no copy of a list that is already yours', () => {
    open();

    expect(
      screen.queryByRole('button', { name: 'Save a copy' }),
    ).not.toBeInTheDocument();
  });

  it('shares a link to the list only when asked for one', async () => {
    const { user } = open();

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Share link' }));

    const link = await dialog().findByLabelText<HTMLInputElement>('Link');
    expect(link.value).toMatch(/\/s\/[\w-]{12}$/);
  });

  it('mints the short link before previewing the sheet, so it carries a QR', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user } = open();

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Preview PDF' }));

    await waitFor(() => expect(opened).toHaveBeenCalledTimes(2));
    const url = new URL(`https://triumph.example${opened.mock.calls[1]?.[0]}`);
    expect(url.searchParams.get('share')).toMatch(/^[\w-]{12}$/);
    expect(url.searchParams.get('name')).toBe('Cannae');
  });

  it('copies the list as text', async () => {
    const { user } = open();

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Copy as text…' }));

    expect(dialog().getByRole<HTMLTextAreaElement>('textbox').value).toContain(
      'Cannae',
    );
  });
});
