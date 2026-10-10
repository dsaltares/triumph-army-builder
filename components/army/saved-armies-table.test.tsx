import { screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SavedArmiesTable } from '@/components/army/saved-armies-table';
import type { TriumphSavedArmy } from '@/lib/domain/army/saved-army';
import type {
  SavedArmyEntry,
  SavedArmyStanding,
} from '@/lib/domain/army/saved-army-index';
import { fixtureDataVersion, fixtureSelection } from '@/test/fixtures/army';
import { fantasySelection } from '@/test/fixtures/fantasy';
import { renderUi } from '@/test/ui';

const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

const saved = (
  overrides: Partial<TriumphSavedArmy> = {},
): TriumphSavedArmy => ({
  id: 'army-1',
  game: 'triumph',
  name: 'Cannae',
  armyListId: 'list-carthage',
  dataVersion: fixtureDataVersion,
  selection: fixtureSelection(),
  createdAt: anHourAgo(),
  updatedAt: anHourAgo(),
  ...overrides,
});

const standing = (
  total: number,
  overrides: Partial<SavedArmyStanding> = {},
): SavedArmyStanding => ({
  meter: {
    total,
    cap: 48,
    remaining: 48 - total,
    status: total === 48 ? 'exact' : total > 48 ? 'over' : 'under',
    standPoints: total,
    allyStandPoints: 0,
    battleCardPoints: 0,
    filled: Math.min(1, total / 48),
  },
  legal: true,
  errors: 0,
  warnings: 0,
  ...overrides,
});

const entry = (overrides: Partial<SavedArmyEntry> = {}): SavedArmyEntry => ({
  army: saved(),
  listName: 'Tidewrack Corsairs',
  standing: standing(48),
  ...overrides,
});

const fantasyEntry = (id: string, name: string): SavedArmyEntry =>
  entry({
    army: {
      ...saved({ id, name }),
      game: 'fantasy',
      armyListId: null,
      selection: fantasySelection(),
    },
    listName: null,
  });

const actions = {
  onPreviewPdf: vi.fn(),
  onDownloadPdf: vi.fn(),
  onShare: vi.fn(),
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
};

function Table({
  entries,
  pricing = false,
}: {
  entries: readonly SavedArmyEntry[];
  pricing?: boolean;
}) {
  const [sorting, setSorting] = useState([{ id: 'updatedAt', desc: true }]);
  return (
    <SavedArmiesTable
      entries={entries}
      sorting={sorting}
      onSortingChange={(updater) =>
        setSorting(typeof updater === 'function' ? updater(sorting) : updater)
      }
      pricing={pricing}
      dataVersion={fixtureDataVersion}
      actionsFor={() => actions}
    />
  );
}

const show = (
  entries: readonly SavedArmyEntry[] = [entry()],
  pricing = false,
) => renderUi(<Table entries={entries} pricing={pricing} />);

const listNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('link')[0]?.textContent);

const cells = (name: string) =>
  within(
    screen.getByRole('link', { name }).closest('tr') as HTMLElement,
  ).getAllByRole('cell');

const header = (name: string) => screen.getByRole('columnheader', { name });

describe('SavedArmiesTable', () => {
  it('leads from the list to its builder, from View to its view and from the army to its page', () => {
    show();

    expect(screen.getByRole('link', { name: 'Cannae' })).toHaveAttribute(
      'href',
      '/triumph/build?list=army-1',
    );
    expect(screen.getByRole('link', { name: 'View Cannae' })).toHaveAttribute(
      'href',
      '/my-armies/army-1',
    );
    expect(
      screen.getByRole('link', { name: 'Tidewrack Corsairs' }),
    ).toHaveAttribute('href', '/armies/list-carthage');
  });

  it('leads a Fantasy Triumph list to its own builder and its own view, with no army', () => {
    show([fantasyEntry('army-2', 'Goblin raid')]);

    expect(screen.getByRole('link', { name: 'Goblin raid' })).toHaveAttribute(
      'href',
      '/fantasy/build?list=army-2',
    );
    expect(
      screen.getByRole('link', { name: 'View Goblin raid' }),
    ).toHaveAttribute('href', '/my-armies/army-2');
    expect(
      screen.queryByRole('link', { name: 'Fantasy Triumph' }),
    ).not.toBeInTheDocument();
  });

  it('names the game in its own column, and the army list beside it', () => {
    show([entry(), fantasyEntry('army-2', 'Goblin raid')]);

    const [, triumphGame, triumphArmy] = cells('Cannae');
    expect(triumphGame).toHaveTextContent(/^Triumph!$/);
    expect(triumphArmy).toHaveTextContent(/^Tidewrack Corsairs$/);

    const [name, fantasyGame, fantasyArmy] = cells('Goblin raid');
    expect(fantasyGame).toHaveTextContent(/^Fantasy Triumph$/);
    expect(fantasyArmy).toHaveTextContent(/^—$/);
    expect(
      within(name as HTMLElement).getByText('Fantasy Triumph'),
    ).toHaveClass('sm:hidden');
  });

  it('sorts by game, grouping the lists of each', async () => {
    const { user } = show([
      entry({ army: saved({ id: 'a', name: 'Zama' }) }),
      fantasyEntry('b', 'Goblin raid'),
      entry({ army: saved({ id: 'c', name: 'Cannae' }) }),
      fantasyEntry('d', 'Troll host'),
    ]);

    await user.click(within(header('Game')).getByRole('button'));

    expect(listNames()).toEqual([
      'Goblin raid',
      'Troll host',
      'Zama',
      'Cannae',
    ]);
    expect(header('Game')).toHaveAttribute('aria-sort', 'ascending');

    await user.click(within(header('Game')).getByRole('button'));

    expect(listNames()).toEqual([
      'Zama',
      'Cannae',
      'Goblin raid',
      'Troll host',
    ]);
    expect(header('Game')).toHaveAttribute('aria-sort', 'descending');
  });

  it('shows the points against the cap, and the verdict', () => {
    show();

    expect(screen.getByText('48 / 48')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '48 of 48 points, a full army',
    );
    expect(screen.getByText('Legal')).toBeInTheDocument();
  });

  it('counts the errors of a list that breaks a rule', () => {
    show([entry({ standing: standing(12, { legal: false, errors: 2 }) })]);

    expect(screen.getByText('Illegal · 2 errors')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '12 of 48 points, still to fill',
    );
  });

  it('says an army over the cap is over it', () => {
    show([entry({ standing: standing(50) })]);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '50 of 48 points, over the cap',
    );
  });

  it('stands something in while the points are still being worked out', () => {
    show([entry({ standing: null })], true);

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('Legal')).toBeNull();
  });

  it('admits when a list cannot be priced at all', () => {
    show([entry({ standing: null, listName: null })], false);

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Not in this data bundle')).toBeInTheDocument();
  });

  it('flags a list saved against other list data', () => {
    show([entry({ army: saved({ dataVersion: '2026-01-01.abcdef01' }) })]);

    expect(screen.getByText('Older list data')).toBeInTheDocument();
  });

  it('sorts by a column header, ascending then descending', async () => {
    const { user } = show([
      entry({ army: saved({ id: 'a', name: 'Zama' }) }),
      entry({ army: saved({ id: 'b', name: 'Cannae' }) }),
      entry({ army: saved({ id: 'c', name: 'Ilipa' }) }),
    ]);

    await user.click(within(header('List')).getByRole('button'));

    expect(listNames()).toEqual(['Cannae', 'Ilipa', 'Zama']);
    expect(header('List')).toHaveAttribute('aria-sort', 'ascending');

    await user.click(within(header('List')).getByRole('button'));

    expect(listNames()).toEqual(['Zama', 'Ilipa', 'Cannae']);
    expect(header('List')).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts by points, with the lists it cannot price last', () => {
    renderUi(
      <SavedArmiesTable
        entries={[
          entry({
            army: saved({ id: 'a', name: 'Small' }),
            standing: standing(12),
          }),
          entry({ army: saved({ id: 'b', name: 'Unpriced' }), standing: null }),
          entry({
            army: saved({ id: 'c', name: 'Full' }),
            standing: standing(48),
          }),
        ]}
        sorting={[{ id: 'points', desc: true }]}
        onSortingChange={() => {}}
        pricing={false}
        dataVersion={fixtureDataVersion}
        actionsFor={() => actions}
      />,
    );

    expect(listNames()).toEqual(['Full', 'Small', 'Unpriced']);
  });

  it('offers the list as a PDF to preview or to download', async () => {
    const { user } = show();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Cannae' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Preview PDF' }));

    expect(actions.onPreviewPdf).toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Cannae' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Download PDF' }));

    expect(actions.onDownloadPdf).toHaveBeenCalled();
  });

  it('offers a share link per list', async () => {
    const { user } = show();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Cannae' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Share link' }));

    expect(actions.onShare).toHaveBeenCalled();
  });

  it('offers rename, duplicate and delete per list', async () => {
    const { user } = show();

    await user.click(
      screen.getByRole('button', { name: 'Actions for Cannae' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(actions.onRename).toHaveBeenCalledTimes(1);
  });
});
