import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewListButton } from '@/components/army/new-list-button';
import { listArmies } from '@/lib/db/armies';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { startBuilding } from '@/lib/domain/army/builder';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { builderArmyDetail } from '@/test/fixtures/army';
import { router } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const servedDataVersion = '2026-09-28.0123abcd';

const api = serveApi({ dataVersion: servedDataVersion });

const owner = 'user-hannibal';

const detail = builderArmyDetail();

const newListButton = () => screen.getByRole('button', { name: 'New list' });

beforeEach(async () => {
  vi.setSystemTime(new Date(2026, 8, 20, 9, 30));
  asSignedIn({ id: owner });
  await api.signIn(owner);
  router.push.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NewListButton', () => {
  it('mints a list named after the army and the day, stamped with the served data version, and opens it', async () => {
    const { user } = renderUi(<NewListButton army={detail} />, {
      wrap: api.wrap,
    });

    await user.click(newListButton());

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/triumph/build?list=army-1`),
    );

    const saved = await listArmies(api.database(), owner);
    expect(saved.map(({ name }) => name)).toEqual([
      'Fixture Builder Army · 20 September 2026',
    ]);
    expect(saved[0]?.selection).toEqual(
      startBuilding(buildArmyList(detail), servedDataVersion),
    );
  });

  it('stays where it is when the list could not be created', async () => {
    api.fails('army.create');

    const { user } = renderUi(<NewListButton army={detail} />, {
      wrap: api.wrap,
    });

    await user.click(newListButton());

    await waitFor(() => expect(newListButton()).toBeEnabled());
    expect(router.push).not.toHaveBeenCalled();
    expect(await listArmies(api.database(), owner)).toEqual([]);
  });
});
