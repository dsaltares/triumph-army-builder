import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedArmies } from '@/components/army/use-saved-armies';
import { SessionCacheReset } from '@/components/auth/session-cache-reset';
import { insertArmy } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { asAnonymous, asSignedIn, asSignedOut } from '@/test/auth-client';
import { fixtureSelection } from '@/test/fixtures/army';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'user-hannibal';

function SavedNames() {
  const { data } = useSavedArmies();
  if (!data) {
    return <p>loading</p>;
  }
  return (
    <p>
      {data.length === 0 ? 'none' : data.map(({ name }) => name).join(', ')}
    </p>
  );
}

const ui = () => (
  <>
    <SessionCacheReset />
    <SavedNames />
  </>
);

const holding = async (userId: string, name: string) => {
  await api.signIn(userId);
  await insertArmy(api.database(), {
    id: `army-${userId}`,
    userId,
    name,
    selection: fixtureSelection(),
    at: new Date(Date.UTC(2026, 8, 18, 10, 0)).toISOString(),
  });
};

beforeEach(() => {
  asSignedOut();
});

describe('SessionCacheReset', () => {
  it('fetches the lists again once someone signs in', async () => {
    const { rerender } = renderUi(ui(), { wrap: api.wrap });
    expect(await screen.findByText('none')).toBeInTheDocument();

    await holding(owner, 'Hannibal in Italy');
    asSignedIn({ id: owner });
    rerender(ui());

    expect(await screen.findByText('Hannibal in Italy')).toBeInTheDocument();
  });

  it('drops the lists once they sign out', async () => {
    await holding(owner, 'Hannibal in Italy');
    asSignedIn({ id: owner });
    const { rerender } = renderUi(ui(), { wrap: api.wrap });
    expect(await screen.findByText('Hannibal in Italy')).toBeInTheDocument();

    api.signOut();
    asSignedOut();
    rerender(ui());

    expect(await screen.findByText('none')).toBeInTheDocument();
  });

  it('keeps the lists while a first save mints this browser a session', async () => {
    const { rerender } = renderUi(ui(), { wrap: api.wrap });
    expect(await screen.findByText('none')).toBeInTheDocument();

    await holding('user-browser', 'Saved in this browser');
    asAnonymous('user-browser');
    rerender(ui());

    await expect(
      screen.findByText('Saved in this browser', undefined, { timeout: 250 }),
    ).rejects.toThrow();
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});
