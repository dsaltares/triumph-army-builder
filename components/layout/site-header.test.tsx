import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from '@/components/layout/site-header';
import { serveApi } from '@/test/api';
import { asAnonymous, asSignedIn, asSignedOut } from '@/test/auth-client';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const player = 'user-hannibal';

const open = () => renderUi(<SiteHeader />, { wrap: api.wrap });

const primaryNav = () =>
  within(screen.getByRole('navigation', { name: 'Primary' }));

const adminLink = () => primaryNav().queryByRole('link', { name: 'Admin' });

beforeEach(() => {
  asSignedOut();
});

describe('SiteHeader', () => {
  it('links an admin to the dashboard', async () => {
    asSignedIn({ id: player });
    await api.signInAsAdmin(player);

    open();

    expect(
      await primaryNav().findByRole('link', { name: 'Admin' }),
    ).toHaveAttribute('href', '/admin');
  });

  it('keeps the link from a player who is not an admin', async () => {
    asSignedIn({ id: player });
    await api.signIn(player);

    open();

    await waitFor(() => expect(api.answered()).toBe(1));
    expect(adminLink()).not.toBeInTheDocument();
  });

  it('keeps it from an admin answer that was about someone else', async () => {
    asSignedIn({ id: player });
    await api.signInAsAdmin('user-scipio');

    open();

    await waitFor(() => expect(api.answered()).toBe(1));
    expect(adminLink()).not.toBeInTheDocument();
  });

  it.each([
    ['a visitor with no session', asSignedOut],
    ['an anonymous browser', () => asAnonymous()],
  ])('shows no link to %s', async (_, arrive) => {
    arrive();

    open();

    expect(
      primaryNav().getByRole('link', { name: 'Collection' }),
    ).toBeVisible();
    expect(adminLink()).not.toBeInTheDocument();
  });
});
