import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewListDialog } from '@/components/army/new-list-dialog';
import { bundlePaths } from '@/lib/data/bundle';
import { listArmies } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { armyIndexEntry } from '@/test/fixtures/army';
import { router } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const armies = [
  armyIndexEntry({
    id: 'army-sumer',
    key: '1a',
    name: 'Goblin Warrens',
    keywords: ['Goblin'],
  }),
  armyIndexEntry({
    id: 'army-gallic',
    key: '52a',
    name: 'Sylvan Courts',
    keywords: ['Elf'],
    startDate: -400,
    endDate: -50,
  }),
];

const api = serveApi({
  bundle: {
    [bundlePaths.index]: {
      meta: {
        source: 'https://meshwesh.example.test',
        fetchedAt: '2026-09-17T00:00:00.000Z',
        contentHash: 'abcdef01',
      },
      armies,
    },
  },
});

const owner = 'user-hannibal';

const openPicker = async () => {
  const rendered = renderUi(<NewListDialog />, { wrap: api.wrap });
  await rendered.user.click(screen.getByRole('button', { name: 'New list' }));
  return rendered;
};

const search = () =>
  screen.getByRole('searchbox', { name: 'Search army lists' });

const offered = () =>
  within(screen.getByRole('list'))
    .getAllByRole('button')
    .map((choice) => choice.textContent);

beforeEach(async () => {
  vi.setSystemTime(new Date(2026, 8, 20, 9, 30));
  asSignedIn({ id: owner });
  await api.signIn(owner);
  router.push.mockClear();
});

describe('the new list dialog', () => {
  it('offers every army, and starts a list of the one picked', async () => {
    const { user } = await openPicker();

    await screen.findByText('2 army lists');
    expect(offered()).toEqual([
      'Goblin Warrens3000–2800 BC',
      'Sylvan Courts400–50 BC',
    ]);

    await user.click(screen.getByRole('button', { name: /Goblin Warrens/ }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        '/armies/army-sumer/build?list=army-1',
      ),
    );
    expect(
      (await listArmies(api.database(), owner)).map((a) => a.name),
    ).toEqual(['Goblin Warrens · 20 September 2026']);
  });

  it('narrows the armies by name', async () => {
    const { user } = await openPicker();
    await screen.findByText('2 army lists');

    await user.type(search(), 'sylvan');

    await waitFor(() =>
      expect(screen.getByText('1 of 2 army lists')).toBeInTheDocument(),
    );
    expect(offered()).toEqual(['Sylvan Courts400–50 BC']);
  });

  it('starts a list of the first match when the search is submitted', async () => {
    const { user } = await openPicker();
    await screen.findByText('2 army lists');

    await user.type(search(), 'elf{Enter}');

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        '/armies/army-gallic/build?list=army-1',
      ),
    );
  });

  it('offers a way back when nothing matches', async () => {
    const { user } = await openPicker();
    await screen.findByText('2 army lists');

    await user.type(search(), 'corsairs');

    await screen.findByText('No army list matches');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    await screen.findByText('2 army lists');
    expect(offered()).toHaveLength(2);
  });

  it('says so when the index cannot be loaded', async () => {
    await api.missing(bundlePaths.index);

    await openPicker();

    expect(
      await screen.findByText('The army lists could not be loaded'),
    ).toBeInTheDocument();
  });
});
