import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionCoverage } from '@/components/collection/collection-coverage';
import type { TroopTypeCode } from '@/lib/data/schema';
import { insertArmy } from '@/lib/db/armies';
import {
  findCollectionEntry,
  insertCollectionEntry,
} from '@/lib/db/collection';
import { listArmyPins, pinEntry } from '@/lib/db/collection-pins';
import { buildArmyList } from '@/lib/domain/army/army-list';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import {
  type ArmySelection,
  emptySelection,
  withStands,
} from '@/lib/domain/army/selection';
import {
  type NamedCollectionEntry,
  savedView,
} from '@/lib/domain/army/shared-view';
import type { CollectionPin } from '@/lib/domain/collection/coverage';
import { troopTypeCosts } from '@/lib/domain/troop-types';
import { serveApi } from '@/test/api';
import {
  armyDetail,
  entries as troopEntries,
  troopOption,
} from '@/test/fixtures/army';
import { router } from '@/test/next-navigation';
import { sampleBattleCards, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const api = serveApi();

const owner = 'user-lugalzagesi';

const troopTypes = sampleTroopTypes;

const costs = troopTypeCosts(troopTypes);

const armyList = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({
        min: 0,
        max: 12,
        description: 'Sumerian spearmen',
        troopEntries: troopEntries('SPR'),
      }),
      troopOption({
        min: 0,
        max: 6,
        description: 'Bowmen of Akkad',
        troopEntries: troopEntries('ARC'),
      }),
    ],
  }),
);

const [spearmen, archers] = armyList.main.troopOptions;
if (!spearmen || !archers) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const dataVersion = '2026-09-17.abcdef01';

const empty = emptySelection({ army: armyList.id, dataVersion, year: -2900 });

const lagash = withStands(
  withStands(empty, spearmen, 'SPR', 6),
  archers,
  'ARC',
  2,
);

const listPoints = 6 * costs.SPR + 2 * costs.ARC;

const entry = (
  name: string,
  count: number,
  troopType: TroopTypeCode,
  overrides: Partial<NamedCollectionEntry> = {},
): NamedCollectionEntry => ({
  id: name,
  name,
  count,
  troopType,
  tags: [],
  status: 'painted',
  ...overrides,
});

const saved = (selection: ArmySelection): SavedArmy => ({
  id: 'saved-1',
  name: 'Lagash',
  armyListId: armyList.id,
  dataVersion,
  selection,
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
});

const show = async (
  collection: readonly NamedCollectionEntry[] | null,
  selection: ArmySelection = lagash,
  pins: readonly CollectionPin[] = [],
) => {
  const rendered = renderUi(
    <CollectionCoverage
      armyId="saved-1"
      collection={
        savedView({
          saved: saved(selection),
          collection,
          pins,
          armyList,
          troopTypes,
          battleCards: sampleBattleCards,
        }).collection
      }
      control={{ open: true, onOpenChange: () => {} }}
    />,
    { wrap: api.wrap },
  );
  await screen.findByRole('dialog', { name: 'Can I build it?' });
  return rendered;
};

const keep = async (
  entries: readonly NamedCollectionEntry[],
  pins: readonly CollectionPin[] = [],
) => {
  const db = api.database();
  await insertArmy(db, {
    id: 'saved-1',
    userId: owner,
    name: 'Lagash',
    selection: lagash,
    at: '2026-09-18T10:00:00.000Z',
  });
  for (const { id, name, count, troopType, tags, status } of entries) {
    await insertCollectionEntry(db, {
      id,
      userId: owner,
      name,
      count,
      troopType,
      tags: [...tags],
      status,
      notes: '',
      at: '2026-09-18T10:00:00.000Z',
    });
  }
  for (const pin of pins) {
    await pinEntry(db, { armyId: 'saved-1', userId: owner }, pin);
  }
};

const pinsKept = () =>
  listArmyPins(api.database(), { armyId: 'saved-1', userId: owner });

const row = (troopType: string) => {
  const found = screen
    .getAllByRole('row')
    .find((item) =>
      within(item).queryByRole('rowheader', { name: new RegExp(troopType) }),
    );
  if (!found) {
    throw new Error(`no row holds ${troopType}`);
  }
  return within(found);
};

const field = (scope: ReturnType<typeof row>, label: string) => {
  const [rowHeading] = scope.getAllByRole('rowheader');
  const table = rowHeading?.closest('table');
  if (!(table instanceof HTMLElement)) {
    throw new Error('the row is not in a table');
  }
  const index = within(table)
    .getAllByRole('columnheader')
    .findIndex((heading) => heading.textContent === label);
  const found = [
    ...scope.getAllByRole('rowheader'),
    ...scope.getAllByRole('cell'),
  ][index];
  if (!found) {
    throw new Error(`no field is labelled ${label}`);
  }
  return within(found);
};

describe('CollectionCoverage', () => {
  it('asks a player without an account to sign in, in place of coverage', async () => {
    await show(null);

    expect(
      screen.getByRole('heading', { name: 'Can I build it?', level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByText('Sign in to check this list against your collection'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(
      screen.getByRole('link', { name: 'Create account' }),
    ).toHaveAttribute('href', '/sign-up');
    expect(screen.queryByText(/points covered/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Collection' }),
    ).not.toBeInTheDocument();
  });

  it('offers the collection when it has nothing in it yet', async () => {
    await show([]);

    expect(screen.getByText('Your collection is empty')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Go to your collection' }),
    ).toHaveAttribute('href', '/collection');
  });

  it('says there is nothing to cover on a list with no stands', async () => {
    await show([entry('Lagash spearmen', 6, 'SPR')], empty);

    expect(
      screen.getByText(
        'This list has no stands yet, so there is nothing to cover.',
      ),
    ).toBeVisible();
  });

  it('says a fully covered, fully painted list is ready to field', async () => {
    await show([
      entry('Lagash spearmen', 6, 'SPR', { tags: ['spearmen'] }),
      entry('Sunspire archers', 2, 'ARC', { tags: ['archers'] }),
    ]);

    expect(
      screen.getByText(
        `${listPoints} of ${listPoints} points covered · ready to field`,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Your collection covers every stand, all of them painted',
      ),
    ).toBeVisible();
    expect(screen.getAllByText('✓ Ready')).toHaveLength(2);
    expect(
      screen.queryByRole('link', { name: 'Add an entry' }),
    ).not.toBeInTheDocument();
  });

  it('shows each troop option’s need, what covers it and what is left to buy', async () => {
    await show([entry('Lagash spearmen', 4, 'SPR', { tags: ['spearmen'] })]);

    expect(
      screen.getByText(
        `${4 * costs.SPR} of ${listPoints} points covered · 4 to buy`,
      ),
    ).toBeVisible();

    const spear = row('Spear');
    expect(field(spear, 'Need').getByText('6')).toBeVisible();
    expect(field(spear, 'Covered').getByText('4')).toBeVisible();
    expect(
      field(spear, 'From your collection').getByText('✓ Match'),
    ).toBeVisible();
    expect(
      field(spear, 'From your collection').getByText('Lagash spearmen × 4'),
    ).toBeVisible();
    expect(field(spear, 'Still to do').getByText('✗ 2 to buy')).toBeVisible();
    expect(
      field(spear, 'Actions').getByRole('link', { name: 'Add an entry' }),
    ).toHaveAttribute('href', '/collection?new=SPR');

    const bows = row('Archers');
    expect(
      field(bows, 'From your collection').getByText(
        'Nothing in your collection fields as this',
      ),
    ).toBeVisible();
    expect(field(bows, 'Still to do').getByText('✗ 2 to buy')).toBeVisible();

    expect(screen.getByRole('link', { name: 'Collection' })).toHaveAttribute(
      'href',
      '/collection',
    );
  });

  it('marks a stand-in and counts its unpainted stands to paint', async () => {
    await show([
      entry('Lagash spearmen', 6, 'SPR', { tags: ['spearmen'] }),
      entry('Slingers', 2, 'ARC', { status: 'unpainted' }),
    ]);

    expect(
      screen.getByText(
        `${listPoints} of ${listPoints} points covered · 2 stands to paint`,
      ),
    ).toBeVisible();

    const bows = row('Archers');
    const from = field(bows, 'From your collection');
    expect(from.getByText('~ Stand-in')).toBeVisible();
    expect(from.getByText('Slingers × 2')).toBeVisible();
    expect(from.getByText('Unpainted')).toBeVisible();
    expect(field(bows, 'Still to do').getByText('✗ 2 to paint')).toBeVisible();
    expect(
      bows.queryByRole('link', { name: 'Add an entry' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your collection covers every stand, all of them painted',
      ),
    ).not.toBeInTheDocument();
  });
});

describe('choosing what covers a troop', () => {
  const spearmenEntry = entry('Lagash spearmen', 6, 'SPR', {
    tags: ['spearmen'],
  });
  const levy = entry('Levy', 6, 'SPR');
  const levyPin: CollectionPin = {
    option: spearmen.id,
    troopType: 'SPR',
    entry: 'Levy',
    count: 6,
  };

  beforeEach(async () => {
    router.refresh.mockClear();
    await api.signIn(owner);
  });

  it('pins the entry the player picks to the troop and refreshes the page', async () => {
    await keep([spearmenEntry, levy]);
    const { user } = await show([spearmenEntry, levy]);

    await user.click(
      field(row('Spear'), 'Actions').getByRole('button', {
        name: 'Cover with…',
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Levy · 6 stands' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(await pinsKept()).toEqual([levyPin]);
  });

  it('offers nothing to pin where nothing in the collection fields as the troop', async () => {
    await show([spearmenEntry]);

    expect(
      row('Archers').queryByRole('button', { name: 'Cover with…' }),
    ).not.toBeInTheDocument();
  });

  it('says which source is pinned, and unpins it', async () => {
    await keep([spearmenEntry, levy], [levyPin]);
    const { user } = await show([spearmenEntry, levy], lagash, [levyPin]);

    const from = field(row('Spear'), 'From your collection');
    expect(from.getByText('Levy × 6')).toBeVisible();
    expect(from.getByText('Pinned')).toBeVisible();

    await user.click(from.getByRole('button', { name: 'Unpin Levy' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(await pinsKept()).toEqual([]);
  });

  it('tags a stand-in in one tap, so it matches from then on', async () => {
    const slingers = entry('Slingers', 2, 'ARC', { status: 'unpainted' });
    await keep([spearmenEntry, slingers]);
    const { user } = await show([spearmenEntry, slingers]);

    const from = field(row('Archers'), 'From your collection');
    expect(from.getByText('~ Stand-in')).toBeVisible();
    await user.click(
      from.getByRole('button', { name: 'Tag Slingers “bowmen”' }),
    );

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(
      (
        await findCollectionEntry(api.database(), {
          id: 'Slingers',
          userId: owner,
        })
      )?.tags,
    ).toEqual(['bowmen']);
  });

  it('offers no tag to a source that already matches', async () => {
    await show([spearmenEntry]);

    expect(
      field(row('Spear'), 'From your collection').queryByRole('button', {
        name: /^Tag /,
      }),
    ).not.toBeInTheDocument();
  });
});
