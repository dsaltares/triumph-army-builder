import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewListAction } from '@/components/army/new-list-action';
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

const show = () => renderUi(<NewListAction />, { wrap: api.wrap });

beforeEach(() => {
  asSignedIn({ id: owner });
});

describe('NewListAction', () => {
  it('offers a new list to a player who has lists already', async () => {
    await api.signIn(owner);
    await save('saved-1', 'Cannae');
    show();

    expect(
      await screen.findByRole('button', { name: 'New list' }),
    ).toBeInTheDocument();
  });

  it('says nothing when there is nothing saved, because the empty state asks', async () => {
    await api.signIn(owner);
    const { container } = show();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
