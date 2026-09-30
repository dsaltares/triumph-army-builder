import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { resetPassword } from '@/test/auth-client';
import { atSearchParams } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const password = () => screen.getByLabelText('Password');
const repeat = () => screen.getByLabelText('Repeat password');
const submit = () => screen.getByRole('button', { name: /^Sav/ });

const chosen = 'correct horse battery staple';

beforeEach(() => {
  atSearchParams('?token=a-minted-token');
  resetPassword.mockResolvedValue({});
});

describe('ResetPasswordForm', () => {
  it('sends a player who arrived without a token back for a new link', () => {
    atSearchParams('');

    renderUi(<ResetPasswordForm />);

    expect(screen.getByText('That link no longer works')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ask for a new link' }),
    ).toBeInTheDocument();
  });

  it('says so rather than showing the form when the server refused the link', () => {
    atSearchParams('?error=invalid_token');

    renderUi(<ResetPasswordForm />);

    expect(screen.getByText('That link no longer works')).toBeInTheDocument();
  });

  it('checks the new password against its repeat before spending the token', async () => {
    const { user } = renderUi(<ResetPasswordForm />);

    await user.type(password(), chosen);
    await user.type(repeat(), 'correct horse battery stapel');
    await user.click(submit());

    expect(
      await screen.findByText('Those two passwords do not match.'),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('refuses a token nobody minted, with a way back', async () => {
    resetPassword.mockResolvedValue({ error: { code: 'INVALID_TOKEN' } });
    const { user } = renderUi(<ResetPasswordForm />);

    await user.type(password(), chosen);
    await user.type(repeat(), chosen);
    await user.click(submit());

    expect(
      await screen.findByText('That link no longer works'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ask for a new link' }),
    ).toBeInTheDocument();
  });

  it('spends the token and says every old session is signed out', async () => {
    const { user } = renderUi(<ResetPasswordForm />);

    await user.type(password(), chosen);
    await user.type(repeat(), chosen);
    await user.click(submit());

    expect(
      await screen.findByText('Your password is changed'),
    ).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: chosen,
      token: 'a-minted-token',
    });
  });
});
