import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectedAccounts } from '@/components/auth/connected-accounts';
import { connectedAccounts } from '@/lib/auth/connected-accounts';
import { requestPasswordReset } from '@/test/auth-client';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const email = 'hannibal@example.test';

const googleOnly = connectedAccounts(
  [{ id: 'account-2', providerId: 'google' }],
  ['google'],
);

const openAccounts = (accounts = googleOnly) =>
  renderUi(
    <ConnectedAccounts
      email={email}
      accounts={accounts}
      rejection={undefined}
    />,
  );

beforeEach(() => {
  requestPasswordReset.mockReset();
  requestPasswordReset.mockResolvedValue({});
});

describe('ConnectedAccounts', () => {
  it('mails the account its own link to set a password', async () => {
    const { user } = openAccounts();

    await user.click(screen.getByRole('button', { name: 'Set a password' }));

    expect(requestPasswordReset).toHaveBeenCalledWith({
      email,
      redirectTo: '/reset-password',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      `A link to choose a password is on its way to ${email}.`,
    );
    expect(
      screen.queryByRole('button', { name: 'Set a password' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the button when the link could not be sent', async () => {
    requestPasswordReset.mockResolvedValue({
      error: { status: 429, code: 'TOO_MANY_RESET_REQUESTS' },
    });
    const { user } = openAccounts();

    await user.click(screen.getByRole('button', { name: 'Set a password' }));

    expect(
      await screen.findByRole('button', { name: 'Set a password' }),
    ).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers no password to an account that already has one', () => {
    openAccounts(
      connectedAccounts(
        [
          { id: 'account-1', providerId: 'credential' },
          { id: 'account-2', providerId: 'google' },
        ],
        ['google'],
      ),
    );

    expect(
      screen.queryByRole('button', { name: 'Set a password' }),
    ).not.toBeInTheDocument();
  });
});
