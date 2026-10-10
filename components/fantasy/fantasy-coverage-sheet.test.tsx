import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FantasyCoverageSheet } from '@/components/fantasy/fantasy-coverage-sheet';
import { bundlePaths } from '@/lib/data/bundle';
import type { NewCollectionEntryRecord } from '@/lib/db/collection';
import { insertCollectionEntry } from '@/lib/db/collection';
import type { FantasyReference } from '@/lib/domain/fantasy/reference';
import { serveApi } from '@/test/api';
import { asSignedIn, asSignedOut } from '@/test/auth-client';
import {
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy';
import samplePack from '@/test/fixtures/reference/sample-pack.json';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'user-hannibal';

const packed = (path: string) =>
  samplePack.locales.en.find((file) => file.path === path)?.contents;

const reference = {
  troopTypes: packed(bundlePaths.fantasy.troopTypes),
  cards: packed(bundlePaths.fantasy.battleCards),
  format: packed(bundlePaths.fantasy.format),
} as FantasyReference;

const raid = fantasySelection({
  units: [
    fantasyUnit('wargs', 'JCV', {
      name: 'Warg riders',
      tags: ['wolf'],
      stands: 3,
    }),
    fantasyUnit('boars', 'JCV', { name: 'Boar riders', stands: 2 }),
  ],
  heroes: [fantasyHero('shaman', { tags: ['staff'] })],
});

type EntryContent = Omit<NewCollectionEntryRecord, 'userId' | 'at'>;

const addEntry = (entry: Partial<EntryContent> & Pick<EntryContent, 'id'>) =>
  insertCollectionEntry(api.database(), {
    userId: owner,
    at: '2026-10-10T10:00:00.000Z',
    name: entry.id,
    count: 1,
    troopType: 'JCV',
    tags: [],
    games: ['fantasy'],
    status: 'painted',
    notes: '',
    ...entry,
  });

const openSheet = async () => {
  renderUi(
    <FantasyCoverageSheet
      selection={raid}
      reference={reference}
      control={{ open: true, onOpenChange: () => {} }}
    />,
    { wrap: (children) => api.wrap(children) },
  );
  return within(await screen.findByRole('dialog', { name: 'Can I build it?' }));
};

const signIn = async () => {
  await api.signIn(owner);
  asSignedIn({ id: owner });
};

describe('FantasyCoverageSheet', () => {
  afterEach(asSignedOut);

  it('asks a signed-out player to sign in, without reading a collection', async () => {
    const sheet = await openSheet();

    expect(
      sheet.getByText('Sign in to check this list against your collection'),
    ).toBeInTheDocument();
  });

  it('lays the units and the heroes out in tables of their own', async () => {
    await signIn();
    await addEntry({ id: 'Wolf pack', count: 3, tags: ['wolf'] });

    const sheet = await openSheet();

    const units = await sheet.findByRole('table', { name: 'Units' });
    const heroes = sheet.getByRole('table', { name: 'Heroes' });
    expect(
      within(units).getByRole('rowheader', { name: /Warg riders/ }),
    ).toHaveTextContent('Javelin Cavalry · wolf');
    expect(
      within(heroes).getByRole('rowheader', { name: /Hero 1/ }),
    ).toHaveTextContent('staff');
  });

  it('covers each unit with the entry its name or tags match', async () => {
    await signIn();
    await addEntry({ id: 'Boar pack', count: 2, tags: ['boar'] });
    await addEntry({ id: 'Wolf pack', count: 3, tags: ['wolf'] });

    const sheet = await openSheet();

    const units = await sheet.findByRole('table', { name: 'Units' });
    const wargs = within(units)
      .getByRole('rowheader', { name: /Warg riders/ })
      .closest('tr') as HTMLElement;
    const boars = within(units)
      .getByRole('rowheader', { name: /Boar riders/ })
      .closest('tr') as HTMLElement;
    expect(within(wargs).getByText('Wolf pack × 3')).toBeInTheDocument();
    expect(within(boars).getByText('Boar pack × 2')).toBeInTheDocument();
  });

  it('covers a hero only with a hero entry, and adds a hero entry for one to buy', async () => {
    await signIn();
    await addEntry({ id: 'Cavalry', count: 6 });

    const sheet = await openSheet();

    const heroes = await sheet.findByRole('table', { name: 'Heroes' });
    expect(within(heroes).getByText('✗ 1 to buy')).toBeInTheDocument();
    expect(
      within(heroes).getByRole('link', { name: 'Add an entry' }),
    ).toHaveAttribute('href', '/collection?new=hero');
  });

  it('adds stands to buy as an entry kept for Fantasy Triumph', async () => {
    await signIn();
    await addEntry({ id: 'Wizard', kind: 'hero', troopType: null });

    const sheet = await openSheet();

    const units = await sheet.findByRole('table', { name: 'Units' });
    const [addStands] = within(units).getAllByRole('link', {
      name: 'Add an entry',
    });
    expect(addStands).toHaveAttribute(
      'href',
      '/collection?new=JCV&game=fantasy',
    );
  });

  it('reads none of the stands kept for Triumph! alone', async () => {
    await signIn();
    await addEntry({ id: 'Triumph cavalry', count: 5, games: ['triumph'] });

    const sheet = await openSheet();

    expect(
      await sheet.findByText(/^0 of [\d.]+ points covered · 6 to buy$/),
    ).toBeInTheDocument();
  });
});
