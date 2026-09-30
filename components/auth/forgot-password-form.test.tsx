import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { requestPasswordReset } from '@/test/auth-client';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const email = () => screen.getByLabelText('Email');
const submit = () =>
  screen.getByRole('button', { name: /^(Email me|Sending)/ });

beforeEach(() => {
  requestPasswordReset.mockResolvedValue({});
});

describe('ForgotPasswordForm', () => {
  it('checks the address before asking the server', async () => {
    const { user } = renderUi(<ForgotPasswordForm />);

    await user.type(email(), 'hannibal');
    await user.click(submit());

    expect(
      await screen.findByText('That does not look like an email address.'),
    ).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('says nothing about who has an account', async () => {
    const { user } = renderUi(<ForgotPasswordForm />);

    await user.type(email(), 'nobody@example.test');
    await user.click(submit());

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(
      screen.getByText(/If that address has an account, a link/),
    ).toBeInTheDocument();
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: 'nobody@example.test',
      redirectTo: '/reset-password',
    });
  });
});
