import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewListDialog } from '@/components/army/new-list-dialog';
import { listArmies } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import samplePack from '@/test/fixtures/reference/sample-pack.json';
import { router } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi({
  bundle: Object.fromEntries(
    samplePack.locales.en.map(({ path, contents }) => [path, contents]),
  ),
});

const owner = 'user-hannibal';

const openDialog = async () => {
  const rendered = renderUi(<NewListDialog />, { wrap: api.wrap });
  await rendered.user.click(screen.getByRole('button', { name: 'New list' }));
  return { ...rendered, dialog: within(screen.getByRole('dialog')) };
};

beforeEach(async () => {
  vi.setSystemTime(new Date(2026, 9, 9, 9, 30));
  asSignedIn({ id: owner });
  await api.signIn(owner);
  router.push.mockClear();
});

describe('a new list when the pack offers Fantasy Triumph', () => {
  it('asks for the game before the army', async () => {
    const { user, dialog } = await openDialog();

    await user.click(await dialog.findByRole('button', { name: /^Triumph!/ }));

    expect(
      await dialog.findByRole('searchbox', { name: 'Search army lists' }),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Another game' }));

    expect(
      dialog.getByRole('button', { name: /^Fantasy Triumph/ }),
    ).toBeInTheDocument();
  });

  it('skips the army for Fantasy Triumph, and starts a list at the points total asked for', async () => {
    const { user, dialog } = await openDialog();

    await user.click(
      await dialog.findByRole('button', { name: /^Fantasy Triumph/ }),
    );
    const name = await dialog.findByRole('textbox', { name: 'List name' });
    const points = dialog.getByRole('spinbutton', { name: 'Points total' });

    expect(name).toHaveValue('Fantasy Triumph · 9 October 2026');
    expect(points).toHaveValue(51);

    await user.clear(name);
    await user.type(name, 'Goblin raid');
    await user.clear(points);
    await user.type(points, '36');
    await user.click(dialog.getByRole('button', { name: 'Start list' }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/fantasy/build?list=army-1'),
    );
    const [list] = await listArmies(api.database(), owner);
    expect(list).toMatchObject({
      name: 'Goblin raid',
      game: 'fantasy',
      armyListId: null,
      selection: { format: { pointsTotal: 36 }, units: [] },
    });
  });

  it('asks for a points total above zero', async () => {
    const { user, dialog } = await openDialog();
    await user.click(
      await dialog.findByRole('button', { name: /^Fantasy Triumph/ }),
    );
    const points = await dialog.findByRole('spinbutton', {
      name: 'Points total',
    });

    await user.clear(points);
    await user.click(dialog.getByRole('button', { name: 'Start list' }));

    expect(
      await dialog.findByText('Give the list a points total above zero'),
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
