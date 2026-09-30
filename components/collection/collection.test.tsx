import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from '@/components/collection/collection';
import { bundlePaths } from '@/lib/data/bundle';
import type { TroopTypeCode } from '@/lib/data/schema';
import { insertCollectionEntry } from '@/lib/db/collection';
import type { CollectionStatus } from '@/lib/domain/collection/entry';
import { serveApi } from '@/test/api';
import { asAnonymous, asSignedIn, asSignedOut } from '@/test/auth-client';
import { bundledTroopTypes } from '@/test/bundle-source';
import { renderUi, type UiOptions } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi({
  bundle: {
    [bundlePaths.index]: {
      meta: {
        source: 'https://meshwesh.example.test',
        fetchedAt: '2026-09-17T00:00:00.000Z',
        contentHash: 'abcdef01',
      },
      armies: [],
    },
    [bundlePaths.troopTypes]: bundledTroopTypes,
  },
});

const whichArmies = { name: 'Which armies can I build?' };

const owner = 'user-hannibal';

let minted = 0;

const own = (
  name: string,
  count: number,
  status: CollectionStatus,
  troopType: TroopTypeCode,
  tags: string[] = [],
) =>
  insertCollectionEntry(api.database(), {
    id: `entry-${++minted}`,
    userId: owner,
    name,
    count,
    status,
    troopType,
    tags,
    notes: '',
    at: new Date(Date.UTC(2026, 8, 18, 10, minted)).toISOString(),
  });

const open = (options: UiOptions = {}) =>
  renderUi(<Collection />, { wrap: api.wrap, ...options });

const rowOf = (name: string) => {
  const row = screen
    .getAllByRole('row')
    .find((item) => within(item).queryByText(name));
  if (!row) {
    throw new Error(`No row for ${name}`);
  }
  return within(row);
};

const openFilters = async (user: ReturnType<typeof open>['user']) => {
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  await screen.findByRole('heading', { name: 'Filters' });
};

const chip = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', {
    name,
  });

const apply = (user: ReturnType<typeof open>['user'], name: string) =>
  user.click(screen.getByRole('button', { name }));

beforeEach(() => {
  minted = 0;
});

describe('Collection without an account', () => {
  it('pitches a collection to a signed-out player and offers sign-in', async () => {
    asSignedOut();
    open();

    expect(
      await screen.findByText('Sign in to keep a collection'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/every list you build shows what they cover/),
    ).toBeInTheDocument();
    expect(screen.getByText(/outlives this browser/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(
      screen.getByRole('link', { name: 'Create account' }),
    ).toHaveAttribute('href', '/sign-up');
  });

  it('pitches the same to an anonymous player, whose lists do not make an account', async () => {
    await api.signInAnonymously('user-browser');
    asAnonymous('user-browser');
    open();

    expect(
      await screen.findByText('Sign in to keep a collection'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });
});

describe('Collection', () => {
  beforeEach(async () => {
    asSignedIn({ id: owner });
    await api.signIn(owner);
  });

  it('says what a collection does while it is empty, without asking to sign in', async () => {
    open();

    expect(
      await screen.findByText('Your collection is empty'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/every list you build shows what they cover/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'See your lists' }),
    ).toHaveAttribute('href', '/my-armies');
    expect(screen.queryByRole('heading', whichArmies)).toBeNull();
  });

  it('asks which armies the collection can build once it holds an entry', async () => {
    await own('Hoplites', 6, 'inProgress', 'HFT');
    open();

    expect(await screen.findByRole('heading', whichArmies)).toBeInTheDocument();
  });

  it('lists every entry with its stands, troop types and status', async () => {
    await own('Macedonian phalangites', 8, 'painted', 'PIK', [
      'macedonian',
      'pike',
    ]);
    await own('Hoplites', 6, 'inProgress', 'HFT');
    open();

    await screen.findByText('Macedonian phalangites');

    const phalangites = rowOf('Macedonian phalangites');
    expect(phalangites.getByText('macedonian · pike')).toBeInTheDocument();
    expect(phalangites.getByText('8')).toBeInTheDocument();
    expect(phalangites.getByText('PIK')).toBeInTheDocument();
    expect(phalangites.getByText('Painted')).toBeInTheDocument();

    const hoplites = rowOf('Hoplites');
    expect(hoplites.getByText('HFT')).toBeInTheDocument();
    expect(hoplites.getByText('In progress')).toBeInTheDocument();
  });

  it('sorts by a column header, keeps the sort in the URL, and flips it', async () => {
    await own('Hoplites', 6, 'inProgress', 'HFT');
    await own('Thracians', 1, 'unpainted', 'WBD');
    await own('Phalangites', 8, 'painted', 'PIK');
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    await screen.findByText('Hoplites');
    const entryNames = () =>
      screen.getAllByRole('rowheader').map((cell) => cell.textContent);
    const heading = (name: string) =>
      screen.getByRole('columnheader', { name });

    expect(entryNames()).toEqual(['Phalangites', 'Thracians', 'Hoplites']);

    await user.click(within(heading('Stands')).getByRole('button'));
    expect(entryNames()).toEqual(['Phalangites', 'Hoplites', 'Thracians']);
    expect(heading('Stands')).toHaveAttribute('aria-sort', 'descending');
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe(
      '?sort=stands&dir=desc',
    );

    await user.click(within(heading('Stands')).getByRole('button'));
    expect(entryNames()).toEqual(['Thracians', 'Hoplites', 'Phalangites']);
    expect(heading('Stands')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('opens sorted the way the URL says', async () => {
    await own('Hoplites', 6, 'inProgress', 'HFT');
    await own('Thracians', 1, 'unpainted', 'WBD');
    await own('Phalangites', 8, 'painted', 'PIK');
    open({ searchParams: '?sort=status&dir=desc' });
    await screen.findByText('Hoplites');

    expect(
      screen.getAllByRole('rowheader').map((cell) => cell.textContent),
    ).toEqual(['Phalangites', 'Hoplites', 'Thracians']);
    expect(
      screen.getByRole('columnheader', { name: 'Status' }),
    ).toHaveAttribute('aria-sort', 'descending');
  });

  it('totals the stands owned, painted and still to paint', async () => {
    await own('Macedonian phalangites', 8, 'painted', 'PIK');
    await own('Hoplites', 6, 'inProgress', 'HFT');
    await own('Thracians', 1, 'unpainted', 'WBD');
    open();

    expect(
      await screen.findByText('15 stands · 8 painted · 7 to paint'),
    ).toBeInTheDocument();
  });

  it('offers a chip for each troop type the collection fields, and filters by it', async () => {
    await own('Macedonian phalangites', 8, 'painted', 'PIK');
    await own('Hoplites', 6, 'inProgress', 'SPR');
    await own('Spartans', 4, 'painted', 'SPR');
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    await screen.findByText('Hoplites');

    await openFilters(user);
    const troopTypes = within(
      screen.getByRole('group', { name: 'Troop type' }),
    );
    expect(
      troopTypes.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['PIK', 'SPR']);

    await user.click(chip('Troop type', 'SPR'));
    expect(chip('Troop type', 'SPR')).toHaveAttribute('aria-pressed', 'true');
    await apply(user, 'Show 2 entries');

    expect(screen.queryByText('Macedonian phalangites')).toBeNull();
    expect(screen.getByText('Hoplites')).toBeInTheDocument();
    expect(screen.getByText('Spartans')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters 1' })).toBeVisible();
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('?type=SPR');
  });

  it('filters by status, and combines it with the troop type', async () => {
    await own('Macedonian phalangites', 8, 'painted', 'PIK');
    await own('Hoplites', 6, 'inProgress', 'SPR');
    await own('Spartans', 4, 'painted', 'SPR');
    const { user } = open({ searchParams: '?type=SPR' });
    await screen.findByText('Hoplites');

    await openFilters(user);
    await user.click(chip('Status', 'Painted'));
    await apply(user, 'Show 1 entry');

    expect(screen.getByText('Spartans')).toBeInTheDocument();
    expect(screen.queryByText('Hoplites')).toBeNull();
    expect(screen.queryByText('Macedonian phalangites')).toBeNull();
    expect(
      screen.getByText('18 stands · 12 painted · 6 to paint'),
    ).toBeInTheDocument();
  });

  it('searches the names, tags and troop types of the entries', async () => {
    await own('Macedonian phalangites', 8, 'painted', 'PIK', [
      'macedonian',
      'pike',
    ]);
    await own('Hoplites', 6, 'inProgress', 'HFT', ['theban']);
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    await screen.findByText('Hoplites');

    await user.type(
      screen.getByRole('searchbox', { name: 'Search your collection' }),
      'theban',
    );

    await waitFor(() =>
      expect(screen.queryByText('Macedonian phalangites')).toBeNull(),
    );
    expect(screen.getByText('Hoplites')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 entries')).toBeInTheDocument();
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('?q=theban');
  });

  it('filters by the tags the collection carries, picked from a search', async () => {
    await own('Hoplites', 6, 'inProgress', 'HFT', ['theban', 'hoplite']);
    await own('Spartans', 4, 'painted', 'EFT', ['spartan', 'hoplite']);
    await own('Peltasts', 4, 'painted', 'LFT', ['thracian']);
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    await screen.findByText('Hoplites');

    await openFilters(user);
    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'th');
    expect(
      (await screen.findAllByRole('option')).map(
        (option) => option.textContent,
      ),
    ).toEqual(['theban', 'thracian']);
    await user.click(screen.getByRole('option', { name: 'thracian' }));
    expect(
      screen.getByRole('button', { name: 'Remove tag thracian' }),
    ).toBeInTheDocument();
    await apply(user, 'Show 1 entry');

    expect(screen.getByText('Peltasts')).toBeInTheDocument();
    expect(screen.queryByText('Hoplites')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters 1' })).toBeVisible();
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('?tag=thracian');
  });

  it('clears the filters from the sheet, and leaves the search alone', async () => {
    await own('Macedonian phalangites', 8, 'painted', 'PIK');
    await own('Hoplites', 6, 'inProgress', 'HFT');
    await own('Spartans', 4, 'painted', 'EFT');
    const { user } = open({ searchParams: '?q=s&type=PIK' });
    await screen.findByText('Macedonian phalangites');

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await apply(user, 'Show 3 entries');

    expect(screen.getByText('Hoplites')).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: 'Search your collection' }),
    ).toHaveValue('s');
  });

  it('says when no entry passes the search and filters, and clears them', async () => {
    await own('Macedonian phalangites', 8, 'painted', 'PIK');
    await own('Hoplites', 6, 'inProgress', 'HFT');
    const { user } = open({ searchParams: '?q=hop&type=PIK&status=unpainted' });

    expect(
      await screen.findByText('No entries match this search'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Macedonian phalangites')).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'Clear search and filters' }),
    );

    expect(screen.queryByText('No entries match this search')).toBeNull();
    expect(screen.getByText('Macedonian phalangites')).toBeInTheDocument();
    expect(screen.getByText('Hoplites')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeVisible();
  });

  it('keeps a filter the collection no longer fields, so it can be turned off', async () => {
    await own('Hoplites', 6, 'inProgress', 'HFT');
    const { user } = open({ searchParams: '?type=ELE' });

    expect(
      await screen.findByText('No entries match this search'),
    ).toBeInTheDocument();

    await openFilters(user);
    await user.click(chip('Troop type', 'ELE'));
    await apply(user, 'Show 1 entry');

    expect(screen.getByText('Hoplites')).toBeInTheDocument();
  });

  it('says why when the collection does not load', async () => {
    api.signOut();
    open();

    expect(
      await screen.findByText('Your collection did not load'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/it lives on your account, not on this browser/),
    ).toBeInTheDocument();
  });
});
