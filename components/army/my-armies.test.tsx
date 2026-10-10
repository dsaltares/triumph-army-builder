import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyArmies } from '@/components/army/my-armies';
import { bundlePaths } from '@/lib/data/bundle';
import { insertArmy } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { asAnonymous, asSignedIn, asSignedOut } from '@/test/auth-client';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army';
import { sampleBattleCards, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi, type UiOptions } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const detail = armyDetail();

const troopTypes = sampleTroopTypes.map(
  ({ id, importName, ...bundled }) => bundled,
);

const api = serveApi({
  bundle: {
    [bundlePaths.army(detail.id)]: detail,
    [bundlePaths.troopTypes]: troopTypes,
    [bundlePaths.battleCards]: sampleBattleCards,
  },
  translated: {
    es: {
      [bundlePaths.army(detail.id)]: { ...detail, name: 'Ejercito de prueba' },
    },
  },
});

const owner = 'user-hannibal';

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 8, 18, 10, minutes)).toISOString();

let minted = 0;

const save = (name: string, minutes: number) =>
  insertArmy(api.database(), {
    id: `saved-${++minted}`,
    userId: owner,
    name,
    selection: fixtureSelection(),
    at: at(minutes),
  });

const open = (options: UiOptions = {}) =>
  renderUi(<MyArmies armyCount={656} />, { wrap: api.wrap, ...options });

const listNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('link')[0]?.textContent);

const openMenu = async (
  user: ReturnType<typeof open>['user'],
  name: string,
) => {
  await user.click(screen.getByRole('button', { name: `Actions for ${name}` }));
};

const dialog = () => within(screen.getByRole('dialog'));

beforeEach(() => {
  minted = 0;
  asSignedIn({ id: owner });
});

describe('MyArmies with nothing saved', () => {
  it('says what the app is for and offers three ways into the armies', async () => {
    asSignedOut();
    open();

    expect(await screen.findByText('No lists saved yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Build, validate and share army lists for the Triumph!/),
    ).toBeInTheDocument();
    expect(screen.getByText(/48 points of troop stands/)).toBeInTheDocument();
    expect(screen.getByText(/656 armies to draw from/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start your first list' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse armies' })).toHaveAttribute(
      'href',
      '/armies',
    );
    expect(screen.getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });

  it('tells an anonymous player their lists are held against this browser', async () => {
    asSignedOut();
    open();

    expect(await screen.findByText('No lists saved yet')).toBeInTheDocument();
    expect(screen.getByText(/saved within your browser/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('says none of that to a player with an account', async () => {
    await api.signIn(owner);
    open();

    expect(await screen.findByText('No lists saved yet')).toBeInTheDocument();
    expect(screen.queryByText(/saved within your browser/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Browse armies' }),
    ).toBeInTheDocument();
  });
});

describe('MyArmies', () => {
  beforeEach(async () => {
    await api.signIn(owner);
  });

  it('reminds an anonymous player that their lists live in this browser', async () => {
    await api.signInAnonymously('user-browser');
    asAnonymous('user-browser');
    await insertArmy(api.database(), {
      id: 'saved-anonymous',
      userId: 'user-browser',
      name: 'Cannae',
      selection: fixtureSelection(),
      at: at(0),
    });
    open();

    expect(
      await screen.findByText('Saved within your browser'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('leaves a player with an account alone', async () => {
    await save('Cannae', 10);
    open();

    expect(await screen.findByText('Cannae')).toBeInTheDocument();
    expect(screen.queryByText('Saved within your browser')).toBeNull();
  });

  it('prices every saved list and says whether it is legal', async () => {
    await save('Cannae', 0);
    open();

    expect(await screen.findByRole('link', { name: 'Cannae' })).toBeVisible();
    expect(await screen.findByText(/^\d+(½)? \/ 48$/)).toBeInTheDocument();
    expect(screen.getByText(/^Illegal · \d+ errors?$/)).toBeInTheDocument();
  });

  it('flags a list saved before the data the server serves revised its army', async () => {
    await save('Cannae', 0);
    await api.importVersion('2026-09-28.0123abcd', {
      [bundlePaths.army(detail.id)]: { ...detail, name: 'Revised Army' },
    });
    open();

    expect(await screen.findByRole('link', { name: 'Cannae' })).toBeVisible();
    expect(screen.getByText('Older list data')).toBeInTheDocument();
  });

  it('flags nothing when the data moved on without touching the list', async () => {
    await save('Cannae', 0);
    await api.importVersion('2026-09-28.0123abcd');
    open();

    expect(await screen.findByRole('link', { name: 'Cannae' })).toBeVisible();
    expect(screen.queryByText('Older list data')).toBeNull();
  });

  it('flags nothing while a list matches the data the server serves', async () => {
    await save('Cannae', 0);
    open();

    expect(await screen.findByRole('link', { name: 'Cannae' })).toBeVisible();
    expect(screen.queryByText('Older list data')).toBeNull();
  });

  it('puts the most recently saved list first', async () => {
    await save('Cannae', 10);
    await save('Zama', 20);
    open();

    await waitFor(() => expect(listNames()).toEqual(['Zama', 'Cannae']));
  });

  it('sorts from a column header, and keeps the choice in the url', async () => {
    await save('Cannae', 10);
    await save('Zama', 20);
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    await waitFor(() => expect(listNames()).toEqual(['Zama', 'Cannae']));

    await user.click(
      within(screen.getByRole('columnheader', { name: 'List' })).getByRole(
        'button',
      ),
    );

    await waitFor(() => expect(listNames()).toEqual(['Cannae', 'Zama']));
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain(
      'sort=name',
    );
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain('dir=asc');
  });

  it('sorts by game from the url, and keeps a new choice there', async () => {
    await save('Cannae', 10);
    const onUrlUpdate = vi.fn();
    const { user } = open({
      searchParams: '?sort=game&dir=desc',
      onUrlUpdate,
    });
    await waitFor(() => expect(listNames()).toEqual(['Cannae']));
    const game = screen.getByRole('columnheader', { name: 'Game' });

    expect(game).toHaveAttribute('aria-sort', 'descending');

    await user.click(within(game).getByRole('button'));

    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain(
      'sort=game',
    );
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain('dir=asc');
  });

  it('opens a saved list at the builder it was built in, and views it read-only', async () => {
    await save('Cannae', 10);
    open();

    await waitFor(() => expect(listNames()).toEqual(['Cannae']));
    expect(screen.getByRole('link', { name: 'Cannae' })).toHaveAttribute(
      'href',
      '/triumph/build?list=saved-1',
    );
    expect(screen.getByRole('link', { name: 'View Cannae' })).toHaveAttribute(
      'href',
      '/my-armies/saved-1',
    );
  });

  it('narrows the lists to a search, and comes back from one that matches nothing', async () => {
    await save('Zama', 10);
    await save('Cannae', 20);
    const { user } = open();
    await waitFor(() => expect(listNames()).toEqual(['Cannae', 'Zama']));

    await user.type(screen.getByLabelText('Search your lists'), 'zam');

    await waitFor(() => expect(listNames()).toEqual(['Zama']));

    await user.clear(screen.getByLabelText('Search your lists'));
    await user.type(screen.getByLabelText('Search your lists'), 'trebia');

    expect(await screen.findByText('No list matches')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => expect(listNames()).toEqual(['Cannae', 'Zama']));
  });

  it('names the game each list is played under', async () => {
    await save('Cannae', 10);
    open();

    await waitFor(() => expect(listNames()).toEqual(['Cannae']));
    const [, row] = screen.getAllByRole('row');
    expect(within(row as HTMLElement).getByText('Triumph!')).toBeVisible();
  });

  it('re-reads the army names when the player changes language', async () => {
    await save('Cannae', 10);
    const { changeLocale } = open();
    await screen.findAllByRole('link', { name: 'Fixture Army' });

    changeLocale('es');

    expect(
      await screen.findByRole('link', { name: 'Ejercito de prueba' }),
    ).toBeVisible();
  });

  it('searches the army list the saved list was built from', async () => {
    await save('Cannae', 10);
    const { user } = open();
    await screen.findAllByRole('link', { name: 'Fixture Army' });

    await user.type(screen.getByLabelText('Search your lists'), 'fixture');

    await waitFor(() => expect(listNames()).toEqual(['Cannae']));
  });

  it('shares a link to a list from its menu', async () => {
    await save('Cannae', 10);
    const { user } = open();
    await screen.findByText('Cannae');

    await openMenu(user, 'Cannae');
    await user.click(screen.getByRole('menuitem', { name: 'Share link' }));

    const link = await dialog().findByLabelText<HTMLInputElement>('Link');
    expect(link.value).toMatch(/\/s\/[\w-]{12}$/);
  });

  it('mints the short link before previewing the sheet, so it carries a QR', async () => {
    await save('Cannae', 10);
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user } = open();
    await screen.findByText('Cannae');

    await openMenu(user, 'Cannae');
    await user.click(screen.getByRole('menuitem', { name: 'Preview PDF' }));

    await waitFor(() => expect(opened).toHaveBeenCalledTimes(2));
    const url = new URL(`https://triumph.example${opened.mock.calls[1]?.[0]}`);
    expect(url.searchParams.get('share')).toMatch(/^[\w-]{12}$/);
    expect(url.searchParams.get('disposition')).toBe('inline');
  });

  it('renames a list from its menu', async () => {
    await save('Cannae', 10);
    const { user } = open();
    await screen.findByText('Cannae');

    await openMenu(user, 'Cannae');
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    await user.clear(dialog().getByLabelText('List name'));
    await user.type(dialog().getByLabelText('List name'), 'Zama');
    await user.click(dialog().getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(listNames()).toEqual(['Zama']));
  });

  it('refuses to leave a list without a name', async () => {
    await save('Cannae', 10);
    const { user } = open();
    await screen.findByText('Cannae');

    await openMenu(user, 'Cannae');
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    await user.clear(dialog().getByLabelText('List name'));
    await user.click(dialog().getByRole('button', { name: 'Rename' }));

    expect(
      await screen.findByText('Name your list so you can find it again'),
    ).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(listNames()).toEqual(['Cannae']));
  });

  it('duplicates a list under a copied name', async () => {
    await save('Cannae', 10);
    const { user } = open();
    await screen.findByText('Cannae');

    await openMenu(user, 'Cannae');
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    await waitFor(() =>
      expect(listNames()).toEqual(['Cannae (copy)', 'Cannae']),
    );
  });

  it('asks before deleting a list, and keeps it when told to', async () => {
    await save('Cannae', 10);
    const { user } = open();
    await screen.findByText('Cannae');

    await openMenu(user, 'Cannae');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(dialog().getByText('Delete Cannae?')).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: 'Keep it' }));

    expect(listNames()).toEqual(['Cannae']);
  });

  it('deletes a list once it is confirmed', async () => {
    await save('Cannae', 10);
    const { user } = open();
    await screen.findByText('Cannae');

    await openMenu(user, 'Cannae');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(dialog().getByRole('button', { name: 'Delete list' }));

    expect(await screen.findByText('No lists saved yet')).toBeInTheDocument();
  });
});
