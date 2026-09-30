import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedArmyCount } from '@/components/army/saved-army-count';
import { insertArmy } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { fixtureSelection } from '@/test/fixtures/army';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'user-hannibal';

const save = (id: string, name: string) =>
  insertArmy(api.database(), {
    id,
    userId: owner,
    name,
    selection: fixtureSelection(),
    at: '2026-09-18T10:00:00.000Z',
  });

const show = () => renderUi(<SavedArmyCount />, { wrap: api.wrap });

beforeEach(() => {
  asSignedIn({ id: owner });
});

describe('SavedArmyCount', () => {
  it('counts the lists the player has saved', async () => {
    await api.signIn(owner);
    await save('saved-1', 'Cannae');
    await save('saved-2', 'Zama');
    show();

    expect(await screen.findByText('2 lists')).toBeInTheDocument();
  });

  it('counts one list as one', async () => {
    await api.signIn(owner);
    await save('saved-1', 'Cannae');
    show();

    expect(await screen.findByText('1 list')).toBeInTheDocument();
  });

  it('says nothing at all when there is nothing saved', async () => {
    await api.signIn(owner);
    const { container } = show();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
