import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { signUp } from '@/test/auth-client';
import { atSearchParams } from '@/test/next-navigation';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const email = () => screen.getByLabelText('Email');
const password = () => screen.getByLabelText('Password');
const repeat = () => screen.getByLabelText('Repeat password');
const submit = () => screen.getByRole('button', { name: /^Creat/ });

const goodPassword = 'correct horse battery staple';

beforeEach(() => {
  atSearchParams('');
  signUp.email.mockResolvedValue({});
});

describe('SignUpForm', () => {
  it('checks every field before it asks the server anything', async () => {
    const { user } = renderUi(<SignUpForm />);

    await user.type(email(), 'hannibal');
    await user.type(password(), 'short');
    await user.type(repeat(), 'shore');
    await user.click(submit());

    expect(
      await screen.findByText('That does not look like an email address.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    expect(
      screen.getByText('Those two passwords do not match.'),
    ).toBeInTheDocument();
    expect(signUp.email).not.toHaveBeenCalled();
  });

  it('checks a field as soon as it is left, not only on submit', async () => {
    const { user } = renderUi(<SignUpForm />);

    await user.type(email(), 'hannibal');
    await user.tab();

    expect(
      await screen.findByText('That does not look like an email address.'),
    ).toBeInTheDocument();

    await user.clear(email());
    await user.type(email(), 'hannibal@example.test');

    expect(
      screen.queryByText('That does not look like an email address.'),
    ).not.toBeInTheDocument();
  });

  it('signs the player up and sends them to their inbox', async () => {
    const { user } = renderUi(<SignUpForm />);

    await user.type(email(), 'Hannibal@Example.test');
    await user.type(password(), goodPassword);
    await user.type(repeat(), goodPassword);
    await user.click(submit());

    expect(
      await screen.findByText(/hannibal@example\.test/),
    ).toBeInTheDocument();
    expect(signUp.email).toHaveBeenCalledWith({
      email: 'hannibal@example.test',
      password: goodPassword,
      name: 'hannibal',
      callbackURL: '/sign-in',
    });
  });

  it('carries where the player was headed through the sign-up', async () => {
    atSearchParams('?next=%2Fmy-armies');
    const { user } = renderUi(<SignUpForm />);

    await user.type(email(), 'hannibal@example.test');
    await user.type(password(), goodPassword);
    await user.type(repeat(), goodPassword);
    await user.click(submit());

    await screen.findByText(/hannibal@example\.test/);

    expect(signUp.email).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: '/sign-in?next=%2Fmy-armies' }),
    );
  });

  it('never says a second sign-up hit a taken address', async () => {
    signUp.email.mockResolvedValue({ error: { code: 'USER_ALREADY_EXISTS' } });
    const { user } = renderUi(<SignUpForm />);

    await user.type(email(), 'hannibal@example.test');
    await user.type(password(), goodPassword);
    await user.type(repeat(), goodPassword);
    await user.click(submit());

    const failure = await screen.findByRole('alert');

    expect(failure).not.toHaveTextContent(/already|taken|exists/i);
  });
});
