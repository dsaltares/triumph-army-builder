import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveSharedCopy } from '@/components/share/save-shared-copy';
import { listArmies } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { fixtureSelection } from '@/test/fixtures/army';
import { router } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const owner = 'user-scipio';

const dialog = () => within(screen.getByRole('dialog'));

const show = () =>
  renderUi(
    <SaveSharedCopy
      name="Cannae"
      list={{ game: 'triumph', selection: fixtureSelection() }}
    />,
    { wrap: api.wrap },
  );

beforeEach(async () => {
  asSignedIn({ id: owner });
  await api.signIn(owner);
  router.push.mockClear();
});

describe('SaveSharedCopy', () => {
  it('keeps the shared list as one of yours, under a name of your choosing', async () => {
    const { user } = show();

    await user.click(screen.getByRole('button', { name: 'Save a copy' }));
    expect(dialog().getByLabelText('List name')).toHaveValue('Cannae');
    await user.clear(dialog().getByLabelText('List name'));
    await user.type(dialog().getByLabelText('List name'), 'Cannae, mine');
    await user.click(dialog().getByRole('button', { name: 'Save copy' }));

    await waitFor(async () =>
      expect(
        (await listArmies(api.database(), owner)).map(({ name }) => name),
      ).toEqual(['Cannae, mine']),
    );
  });

  it('opens the copy in the builder', async () => {
    const { user } = show();

    await user.click(screen.getByRole('button', { name: 'Save a copy' }));
    await user.click(dialog().getByRole('button', { name: 'Save copy' }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/triumph/build?list=army-1'),
    );
  });
});
