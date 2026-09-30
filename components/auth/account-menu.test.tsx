import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMenu } from '@/components/auth/account-menu';
import { asAnonymous, asSignedIn, asSignedOut } from '@/test/auth-client';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const wayIn = () => screen.queryByRole('link', { name: 'Sign in' });

const account = () => screen.queryByRole('button', { name: 'Account' });

beforeEach(() => {
  asSignedOut();
});

describe('AccountMenu', () => {
  it('offers a way in to a visitor with no session', () => {
    renderUi(<AccountMenu />);

    expect(wayIn()).toBeVisible();
    expect(account()).not.toBeInTheDocument();
  });

  it('offers the same way in to a browser holding anonymous lists', () => {
    asAnonymous();

    renderUi(<AccountMenu />);

    expect(wayIn()).toBeVisible();
    expect(account()).not.toBeInTheDocument();
  });

  it('names the account once there is one, and the ways out of it', async () => {
    asSignedIn({ email: 'hannibal@example.test' });
    const { user } = renderUi(<AccountMenu />);

    expect(wayIn()).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Account' }));

    expect(await screen.findByText('hannibal@example.test')).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'My Armies' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });
});
