import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArmyBuilder } from '@/components/builder/army-builder';
import { BuilderActions } from '@/components/builder/builder-actions';
import { BuilderStateProvider } from '@/components/builder/builder-state';
import { ListTitle } from '@/components/builder/list-title';
import { autosaveQuietMs } from '@/components/builder/use-autosave';
import { bundlePaths } from '@/lib/data/bundle';
import { insertArmy, listArmies } from '@/lib/db/armies';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { emptySelection, withStands } from '@/lib/domain/army/selection';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { builderArmyDetail, fixtureDataVersion } from '@/test/fixtures/army';
import { router } from '@/test/next-navigation';
import {
  sampleBattleCards,
  sampleSnapshotBattleCards,
  sampleTroopTypes,
} from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const detail = builderArmyDetail();

const troopTypes = sampleTroopTypes.map(
  ({ id, importName, ...bundled }) => bundled,
);

const battleCardText = Object.fromEntries(
  sampleSnapshotBattleCards.map(({ permanentCode, mdText }) => [
    permanentCode,
    mdText,
  ]),
);

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi({
  bundle: {
    [bundlePaths.army(detail.id)]: detail,
    [bundlePaths.troopTypes]: troopTypes,
    [bundlePaths.battleCards]: sampleBattleCards,
    [bundlePaths.battleCardText]: battleCardText,
  },
});

const builderPage = () => (
  <BuilderStateProvider>
    <ListTitle armyName={detail.name} />
    <BuilderActions />
    <ArmyBuilder armyId={detail.id} />
  </BuilderStateProvider>
);

const openBuilder = async (searchParams = '') => {
  const rendered = renderUi(builderPage(), {
    wrap: api.wrap,
    searchParams,
  });
  await screen.findByRole('heading', { name: 'Required Troops', level: 2 });
  return rendered;
};

const owner = 'user-hannibal';

const armyList = buildArmyList(detail);

const chariots = armyList.main.troopOptions[0];

if (!chariots) {
  throw new Error('the builder fixture no longer opens on its chariots');
}

const savedSelection = withStands(
  emptySelection({
    army: detail.id,
    dataVersion: fixtureDataVersion,
    year: -2900,
    variant: 'kish',
  }),
  chariots,
  'CHT',
  3,
);

const saveListNamed = (name: string) =>
  insertArmy(api.database(), {
    id: 'saved-1',
    userId: owner,
    name,
    selection: savedSelection,
    at: '2026-09-18T10:00:00.000Z',
  });

const dialog = () => within(screen.getByRole('dialog'));

const saveButton = (name: string) => screen.getByRole('button', { name });

const saveStatus = () => screen.getByRole('status', { name: 'Save status' });

const settlesTo = (text: string) =>
  waitFor(() => expect(saveStatus()).toHaveTextContent(text), {
    timeout: autosaveQuietMs * 3,
  });

const storedList = async () => (await listArmies(api.database(), owner))[0];

const listName = () => screen.getByRole('textbox', { name: 'List name' });

beforeEach(async () => {
  vi.setSystemTime(new Date(2026, 8, 20, 9, 30));
  asSignedIn({ id: owner });
  await api.signIn(owner);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ArmyBuilder', () => {
  it('stands a skeleton in until the bundle answers', async () => {
    renderUi(builderPage(), { wrap: api.wrap });

    const skeleton = screen.getByText('Loading the army list');

    await waitForElementToBeRemoved(skeleton);

    expect(
      screen.getByRole('heading', { name: 'Required Troops', level: 2 }),
    ).toBeInTheDocument();
  });

  it('says so when the army list cannot be fetched', async () => {
    await api.missing(bundlePaths.army(detail.id));

    renderUi(builderPage(), { wrap: api.wrap });

    expect(
      await screen.findByText('This army list could not be loaded'),
    ).toBeInTheDocument();
  });

  it('opens a battle card on its full rules, and closes again', async () => {
    const { user } = await openBuilder();

    await user.click(
      screen.getByRole('button', { name: /^Fortified Camp\s*rules$/ }),
    );

    const sheet = within(await screen.findByRole('dialog'));
    expect(
      sheet.getByText(/1 point\. One purchase covers the army/),
    ).toBeInTheDocument();
    expect(
      await sheet.findByText(/adds \+2 to its close combat factor/),
    ).toBeInTheDocument();
    expect(
      sheet.getByRole('link', { name: /Every battle card in the reference/ }),
    ).toHaveAttribute('href', '/reference/battle-cards#FC');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('a list the builder saves', () => {
  it('opens named after its army and the day, and keeps that name', async () => {
    const { user } = await openBuilder();

    expect(listName()).toHaveValue('Fixture Builder Army · 20 September 2026');

    await user.click(saveButton('Save'));

    await settlesTo('Saved');
    expect(listName()).toHaveValue('Fixture Builder Army · 20 September 2026');
  });

  it('stamps a new list with the data version the server serves', async () => {
    await api.importVersion('2026-09-28.0123abcd');
    const { user } = await openBuilder();

    await user.click(saveButton('Save'));

    await settlesTo('Saved');
    expect((await storedList())?.selection.dataVersion).toBe(
      '2026-09-28.0123abcd',
    );
  });

  it('keeps the data version a saved list was built against', async () => {
    await saveListNamed('Cannae');
    await api.importVersion('2026-09-28.0123abcd');
    const { user } = await openBuilder('?list=saved-1');

    await user.click(
      screen.getByRole('button', { name: 'One more Chariots stand' }),
    );

    await settlesTo('Saved');
    expect((await storedList())?.selection.dataVersion).toBe(
      fixtureDataVersion,
    );
  });

  it('keeps every change after the first, with no button to press', async () => {
    const { user } = await openBuilder();

    await user.clear(listName());
    await user.type(listName(), 'Cannae');
    await user.click(saveButton('Save'));

    await settlesTo('Saved');

    await user.click(
      screen.getByRole('button', { name: 'One more Chariots stand' }),
    );

    await settlesTo('Saved');
    expect((await storedList())?.selection.stands[chariots.id]).toEqual({
      CHT: 1,
    });

    await user.clear(listName());
    await user.type(listName(), 'Zama');

    await settlesTo('Saved');
    expect(
      (await listArmies(api.database(), owner)).map(({ name }) => name),
    ).toEqual(['Zama']);
  });

  it('says a change did not save, and keeps it when the save is retried', async () => {
    await saveListNamed('Cannae');

    const { user } = await openBuilder('list=saved-1');

    await settlesTo('Saved');

    api.fails('army.update');
    await user.click(
      screen.getByRole('button', { name: 'One more Chariots stand' }),
    );

    expect(
      await screen.findByRole(
        'button',
        { name: 'Not saved — retry' },
        { timeout: autosaveQuietMs * 3 },
      ),
    ).toBeInTheDocument();
    expect((await storedList())?.selection.stands[chariots.id]).toEqual({
      CHT: 3,
    });

    api.recovers();
    await user.click(saveButton('Not saved — retry'));

    await settlesTo('Saved');
    expect((await storedList())?.selection.stands[chariots.id]).toEqual({
      CHT: 4,
    });
  });

  it('falls back to the name it had when the title is left empty', async () => {
    const { user } = await openBuilder();

    await user.clear(listName());
    await user.tab();

    expect(listName()).toHaveValue('Fixture Builder Army · 20 September 2026');
  });

  it('opens again with everything that was saved in it', async () => {
    await saveListNamed('Cannae');

    await openBuilder('list=saved-1');

    await settlesTo('Saved');
    expect(listName()).toHaveValue('Cannae');
    expect(screen.getByRole('slider', { name: 'Year' })).toHaveValue('-2900');
    expect(screen.getByRole('button', { name: 'Kish' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/^3 of 2–5 stands/)).toBeInTheDocument();
  });

  it('offers no view of a draft nobody has saved yet', async () => {
    const { user } = await openBuilder();

    await user.click(screen.getByRole('button', { name: 'List actions' }));

    expect(
      await screen.findByRole('menuitem', { name: 'Randomize' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'View list' }),
    ).not.toBeInTheDocument();
  });

  it("keeps the change on screen before it leads to the list's view", async () => {
    await saveListNamed('Cannae');
    const { user } = await openBuilder('list=saved-1');
    await settlesTo('Saved');

    const oneMore = screen.getByRole('button', {
      name: 'One more Chariots stand',
    });
    await user.click(oneMore);
    await user.click(oneMore);
    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'View list' }),
    );

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/my-armies/saved-1'),
    );
    expect((await storedList())?.selection.stands[chariots.id]).toEqual({
      CHT: 5,
    });
  });

  it('says so when the saved list is not one of yours', async () => {
    renderUi(builderPage(), {
      wrap: api.wrap,
      searchParams: 'list=not-yours',
    });

    expect(
      await screen.findByText('That saved list could not be opened'),
    ).toBeInTheDocument();
  });
});

describe('a link the builder shares', () => {
  it('makes one short link for the list on the screen, and copies it', async () => {
    const { user } = await openBuilder();

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Share link' }));

    const link = await dialog().findByLabelText<HTMLInputElement>('Link');
    expect(link.value).toMatch(/\/s\/[\w-]{12}$/);

    await user.click(dialog().getByRole('button', { name: 'Copy' }));

    expect(await navigator.clipboard.readText()).toBe(link.value);
    expect(dialog().getByRole('button', { name: 'Copied' })).toBeVisible();
  });

  it('downloads the sheet stamped with the short link its QR code carries', async () => {
    const { user } = await openBuilder();
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download PDF' }));

    await waitFor(() => expect(assign).toHaveBeenCalled());
    const sheet = new URL(
      String(assign.mock.calls[0]?.[0]),
      window.location.origin,
    );
    expect(sheet.pathname).toBe('/api/armies/army-builder/sheet');
    expect(sheet.searchParams.get('s')).toBeTruthy();
    expect(sheet.searchParams.get('share')).toMatch(/^[\w-]{12}$/);
  });

  it('previews the same sheet in a tab of its own', async () => {
    const { user } = await openBuilder();
    const tab = { location: { replace: vi.fn() } };
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(tab as unknown as Window);

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Preview PDF' }));

    await waitFor(() => expect(tab.location.replace).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith('', '_blank');
    const sheet = new URL(
      String(tab.location.replace.mock.calls[0]?.[0]),
      window.location.origin,
    );
    expect(sheet.searchParams.get('disposition')).toBe('inline');
    expect(sheet.searchParams.get('share')).toMatch(/^[\w-]{12}$/);
  });
});
