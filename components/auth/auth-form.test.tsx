import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/components/auth/auth-form';
import { routes } from '@/lib/navigation';
import { renderUi } from '@/test/ui';

const show = ({
  error,
  pending = false,
  next = null,
  onSubmit = () => {},
}: {
  error?: string;
  pending?: boolean;
  next?: string | null;
  onSubmit?: ComponentProps<'form'>['onSubmit'];
} = {}) =>
  renderUi(
    <AuthForm
      onSubmit={onSubmit}
      error={error}
      submit="Sign in"
      working="Signing in…"
      pending={pending}
      next={next}
      footer={{
        prompt: 'No account yet?',
        href: routes.signUp,
        label: 'Create one',
      }}
    >
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" />
    </AuthForm>,
  );

const submit = () => screen.getByRole('button', { name: /Sign(ing)? in/ });

describe('AuthForm', () => {
  it('posts rather than gets, so a password can never reach a URL', () => {
    const { container } = show();

    expect(container.querySelector('form')).toHaveAttribute('method', 'post');
  });

  it('takes the submit button over once React has hydrated', async () => {
    show();

    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).toBeEnabled();
  });

  it('holds the button while the server is answering', () => {
    show({ pending: true });

    expect(submit()).toBeDisabled();
    expect(submit()).toHaveTextContent('Signing in…');
  });

  it('shows the failure it was given above the fields', () => {
    show({ error: 'That did not work.' });

    const failure = screen.getByText('That did not work.');

    expect(failure).toBeInTheDocument();
    expect(
      failure.compareDocumentPosition(screen.getByLabelText('Password')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('submits what the player typed', async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    const { user } = show({ onSubmit });

    await user.type(screen.getByLabelText('Password'), 'hunter2');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('carries where the player was headed into the footer link', () => {
    show({ next: '/my-armies' });

    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute(
      'href',
      '/sign-up?next=%2Fmy-armies',
    );
  });
});
