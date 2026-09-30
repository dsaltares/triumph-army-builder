import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInForm } from '@/components/auth/sign-in-form';
import { signIn } from '@/test/auth-client';
import { atSearchParams, router } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const email = () => screen.getByLabelText('Email');
const password = () => screen.getByLabelText('Password');
const submit = () => screen.getByRole('button', { name: /^Sign(ing)? in/ });

const signInWith = async (
  user: ReturnType<typeof renderUi>['user'],
  address = 'hannibal@example.test',
) => {
  await user.type(email(), address);
  await user.type(password(), 'correct horse battery staple');
  await user.click(submit());
};

beforeEach(() => {
  atSearchParams('');
  signIn.email.mockResolvedValue({});
});

describe('SignInForm', () => {
  it('checks the address before it asks the server anything', async () => {
    const { user } = renderUi(<SignInForm />);

    await user.type(email(), 'hannibal');
    await user.click(submit());

    expect(
      await screen.findByText('That does not look like an email address.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(signIn.email).not.toHaveBeenCalled();
  });

  it('lands a signed-in player where they were headed', async () => {
    atSearchParams('?next=%2Fmy-armies');
    const { user } = renderUi(<SignInForm />);

    await signInWith(user);

    expect(router.replace).toHaveBeenCalledWith('/my-armies');
  });

  it('sends an unconfirmed player back to their inbox', async () => {
    signIn.email.mockResolvedValue({ error: { code: 'EMAIL_NOT_VERIFIED' } });
    const { user } = renderUi(<SignInForm />);

    await signInWith(user);

    expect(
      await screen.findByText(/hannibal@example\.test/),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('refuses a wrong password without saying which half was wrong', async () => {
    signIn.email.mockResolvedValue({
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });
    const { user } = renderUi(<SignInForm />);

    await signInWith(user);

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent(/email|password/i);
    expect(failure).not.toHaveTextContent(/no account|wrong password|unknown/i);
  });
});
