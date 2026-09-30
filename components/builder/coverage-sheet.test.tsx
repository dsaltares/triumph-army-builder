import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoverageSheet } from '@/components/builder/coverage-sheet';
import { insertCollectionEntry } from '@/lib/db/collection';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { emptySelection, withStands } from '@/lib/domain/army/selection';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeMovements,
  troopTypeNames,
} from '@/lib/domain/troop-types';
import { serveApi } from '@/test/api';
import { asAnonymous, asSignedIn, asSignedOut } from '@/test/auth-client';
import { builderArmyDetail } from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const troopTypes = sampleTroopTypes;

const armyList = buildArmyList(builderArmyDetail());

const [chariots] = armyList.main.troopOptions;
if (!chariots) {
  throw new Error('the fixture army no longer has the option the tests need');
}

const selection = withStands(
  emptySelection({
    army: armyList.id,
    dataVersion: '2026-09-17.abcdef01',
    year: -2900,
  }),
  chariots,
  'CHT',
  2,
);

const openSheet = async () => {
  renderUi(
    <CoverageSheet
      armyList={armyList}
      selection={selection}
      costs={{
        troopTypes: troopTypeCosts(troopTypes),
        battleCards: sampleBattleCardCosts,
      }}
      names={troopTypeNames(troopTypes)}
      factors={troopTypeFactors(troopTypes)}
      movement={troopTypeMovements(troopTypes)}
      control={{ open: true, onOpenChange: () => {} }}
    />,
    { wrap: (children) => api.wrap(children) },
  );
  return within(await screen.findByRole('dialog', { name: 'Can I build it?' }));
};

describe('CoverageSheet', () => {
  afterEach(asSignedOut);

  it('asks a signed-out player to sign in, without reading a collection', async () => {
    const sheet = await openSheet();

    expect(
      sheet.getByText('Sign in to check this list against your collection'),
    ).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(
      sheet.queryByRole('link', { name: 'Collection' }),
    ).not.toBeInTheDocument();
  });

  it('asks an anonymous player to sign in too, since a collection needs an account', async () => {
    await api.signInAnonymously('user-browser');
    asAnonymous('user-browser');

    const sheet = await openSheet();

    expect(
      sheet.getByText('Sign in to check this list against your collection'),
    ).toBeInTheDocument();
  });

  it('reads an empty collection as a way into the collection', async () => {
    await api.signIn('user-hannibal');
    asSignedIn({ id: 'user-hannibal' });

    const sheet = await openSheet();

    expect(
      await sheet.findByText('Your collection is empty'),
    ).toBeInTheDocument();
    expect(
      sheet.getByRole('link', { name: 'Go to your collection' }),
    ).toBeInTheDocument();
  });

  it('covers the draft with no pins to offer, since pins belong to a saved list', async () => {
    await api.signIn('user-hannibal');
    asSignedIn({ id: 'user-hannibal' });
    await insertCollectionEntry(api.database(), {
      id: 'entry-chariots',
      userId: 'user-hannibal',
      at: '2026-09-20T10:00:00.000Z',
      name: 'Royal chariots',
      count: 3,
      troopType: 'CHT',
      tags: [],
      status: 'painted',
      notes: '',
    });

    const sheet = await openSheet();

    expect(await sheet.findByText('Royal chariots × 2')).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Collection' })).toHaveAttribute(
      'href',
      '/collection',
    );
    expect(
      sheet.queryByRole('button', { name: 'Cover with…' }),
    ).not.toBeInTheDocument();
  });

  it('says the collection could not be read when the request fails', async () => {
    await api.signIn('user-hannibal');
    asSignedIn({ id: 'user-hannibal' });
    api.fails('collection.list');

    const sheet = await openSheet();

    expect(
      await sheet.findByText('Your collection could not be read'),
    ).toBeInTheDocument();
  });
});
