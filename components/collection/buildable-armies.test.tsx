import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildableArmies } from '@/components/collection/buildable-armies';
import { bundlePaths } from '@/lib/data/bundle';
import type { TroopTypeCode } from '@/lib/data/schema';
import { listArmies } from '@/lib/db/armies';
import { insertCollectionEntry } from '@/lib/db/collection';
import { decodeSelection } from '@/lib/domain/army/share-codec';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { bundledTroopTypes } from '@/test/bundle-source';
import {
  armyDetail,
  armyIndexEntry,
  entries,
  troopOption,
} from '@/test/fixtures/army';
import { sampleBattleCards } from '@/test/sample.ts';
import { renderUi, type UiOptions } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const armyOf = (
  id: string,
  name: string,
  troopType: TroopTypeCode,
  description: string,
) =>
  armyDetail({
    id,
    name,
    troopOptions: [
      troopOption({
        min: 0,
        max: 24,
        description,
        troopEntries: entries(troopType),
      }),
    ],
    troopEntriesForGeneral: [{ troopEntries: entries(troopType) }],
    battleCardEntries: [],
    allyOptions: [],
    allyContingents: [],
  });

const armies = [
  armyOf('army-levy', 'Pike Levy', 'PIK', 'Levy pikemen'),
  armyOf('army-spears', 'Spear Band', 'SPR', 'Spearmen'),
  {
    ...armyOf('army-phalanx', 'Macedonian', 'PIK', 'Phalangites'),
    subFactions: {
      army: 'Macedonian',
      label: 'Sub-faction',
      variants: [{ id: 'argead', name: 'Argead' }],
      rules: {},
    },
  },
];

const api = serveApi({
  bundle: {
    [bundlePaths.index]: {
      meta: {
        source: 'https://meshwesh.example.test',
        fetchedAt: '2026-09-17T00:00:00.000Z',
        contentHash: 'abcdef01',
      },
      armies: armies.map(({ id, name }) => armyIndexEntry({ id, name })),
    },
    [bundlePaths.troopTypes]: bundledTroopTypes,
    [bundlePaths.battleCards]: sampleBattleCards,
    ...Object.fromEntries(
      armies.map((detail) => [bundlePaths.army(detail.id), detail]),
    ),
  },
});

const owner = 'user-hannibal';

let minted = 0;

const own = (
  name: string,
  count: number,
  troopType: TroopTypeCode,
  tags: string[] = [],
) =>
  insertCollectionEntry(api.database(), {
    id: `entry-${++minted}`,
    userId: owner,
    name,
    count,
    status: 'painted',
    troopType,
    tags,
    notes: '',
    at: new Date(Date.UTC(2026, 8, 18, 10, minted)).toISOString(),
  });

const open = (options: UiOptions = {}) =>
  renderUi(<BuildableArmies />, { wrap: api.wrap, ...options });

const cards = async () =>
  within(await screen.findByRole('list'))
    .getAllByRole('link')
    .map((card) => card.textContent);

beforeEach(async () => {
  minted = 0;
  vi.setSystemTime(new Date(2026, 8, 24, 9, 30));
  asSignedIn({ id: owner });
  await api.signIn(owner);
});

describe('which armies can I build', () => {
  it('ranks the armies by points covered, then by the stands that match', async () => {
    await own('Phalangites', 8, 'PIK', ['phalangites']);
    await own('Spearmen', 3, 'SPR');
    open();

    expect(
      screen.getByRole('heading', { name: 'Which armies can I build?' }),
    ).toBeInTheDocument();
    expect(await cards()).toEqual([
      'Macedonian3000 BC · Argead24 points covered · 8 matches · 0 stand-ins',
      'Pike Levy3000 BC24 points covered · 0 matches · 8 stand-ins',
      'Spear Band3000 BC12 points covered · 0 matches · 3 stand-ins',
    ]);
  });

  it('leaves the stand-ins out when the player turns them off', async () => {
    await own('Phalangites', 8, 'PIK', ['phalangites']);
    await own('Spearmen', 3, 'SPR');
    const { user } = open();
    await cards();

    await user.click(screen.getByRole('switch', { name: 'Count stand-ins' }));

    await waitFor(async () =>
      expect(await cards()).toEqual([
        'Macedonian3000 BC · Argead24 points covered · 8 matches · 0 stand-ins',
      ]),
    );
  });

  it('offers to count stand-ins again when nothing builds from matches alone', async () => {
    await own('Spearmen', 3, 'SPR');
    const { user } = open();
    await cards();

    await user.click(screen.getByRole('switch', { name: 'Count stand-ins' }));
    expect(
      await screen.findByText('Nothing builds from matches alone'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Count stand-ins' }));

    expect(await cards()).toEqual([
      'Spear Band3000 BC12 points covered · 0 matches · 3 stand-ins',
    ]);
    expect(
      screen.getByRole('switch', { name: 'Count stand-ins' }),
    ).toBeChecked();
  });

  it('shows only the armies the collection completes when the player asks', async () => {
    await own('Phalangites', 16, 'PIK', ['phalangites']);
    await own('Spearmen', 3, 'SPR');
    const { user } = open();
    await cards();

    await user.click(
      screen.getByRole('switch', { name: 'Complete armies only' }),
    );

    await waitFor(async () =>
      expect(await cards()).toEqual([
        'Macedonian3000 BC · Argead48 points covered · 16 matches · 0 stand-ins',
        'Pike Levy3000 BC48 points covered · 0 matches · 16 stand-ins',
      ]),
    );
  });

  it('offers to show every army when none is complete', async () => {
    await own('Spearmen', 3, 'SPR');
    const { user } = open();
    await cards();

    await user.click(
      screen.getByRole('switch', { name: 'Complete armies only' }),
    );
    expect(
      await screen.findByText('No army is complete from your collection'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show every army' }));

    expect(await cards()).toEqual([
      'Spear Band3000 BC12 points covered · 0 matches · 3 stand-ins',
    ]);
    expect(
      screen.getByRole('switch', { name: 'Complete armies only' }),
    ).not.toBeChecked();
  });

  it('says so when nothing in the collection fields an army, and offers to add an entry', async () => {
    await own('Elephants', 2, 'ELE');
    open();

    expect(
      await screen.findByText('Your collection does not field an army yet'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an entry' })).toHaveAttribute(
      'href',
      '/collection?new=',
    );
  });

  it('opens a result as a view of the list it makes, without saving it', async () => {
    await own('Phalangites', 8, 'PIK', ['phalangites']);
    open();

    const card = await screen.findByRole('link', { name: /^Macedonian/ });
    const href = new URL(card.getAttribute('href') ?? '', 'https://x.test');
    expect(href.pathname).toBe('/collection/preview');
    const decoded = decodeSelection(href.searchParams.get('s') ?? '');
    expect(decoded.ok && decoded.selection).toMatchObject({
      army: 'army-phalanx',
      variant: 'argead',
      stands: { 'main/0': { PIK: 8 } },
      general: { option: 'main/0', troopType: 'PIK' },
    });
    expect(await listArmies(api.database(), owner)).toEqual([]);
  });

  it('searches the armies by name, and keeps the search in the URL', async () => {
    await own('Phalangites', 8, 'PIK', ['phalangites']);
    await own('Spearmen', 3, 'SPR');
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    await cards();

    await user.type(
      screen.getByRole('searchbox', { name: 'Search armies you can build' }),
      'levy',
    );

    await waitFor(async () =>
      expect(await cards()).toEqual([
        'Pike Levy3000 BC24 points covered · 0 matches · 8 stand-ins',
      ]),
    );
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('?army=levy');
  });

  it('says when no army by that name builds, and clears the search', async () => {
    await own('Spearmen', 3, 'SPR');
    const { user } = open({ searchParams: '?army=macedonian' });

    expect(
      await screen.findByText(
        'No army by that name builds from your collection',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await cards()).toEqual([
      'Spear Band3000 BC12 points covered · 0 matches · 3 stand-ins',
    ]);
    expect(
      screen.getByRole('searchbox', { name: 'Search armies you can build' }),
    ).toHaveValue('');
  });

  it('says why when the armies do not load', async () => {
    api.fails('collection.buildable');
    open();

    expect(
      await screen.findByText(
        'The armies your collection can build did not load',
      ),
    ).toBeInTheDocument();
  });
});
