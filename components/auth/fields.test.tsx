import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField, TextField } from '@/components/auth/fields';
import { renderUi } from '@/test/ui';

const password = () => screen.getByLabelText('Password');

describe('TextField', () => {
  it('ties its label, its input and the message under it together', () => {
    renderUi(
      <TextField label="Email" hint="The address you signed up with." />,
    );

    const input = screen.getByLabelText('Email');

    expect(input).toHaveAccessibleDescription(
      'The address you signed up with.',
    );
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('marks the field invalid and describes it by its error', () => {
    renderUi(
      <TextField
        label="Email"
        hint="The address you signed up with."
        error="That does not look like an email address."
      />,
    );

    const input = screen.getByLabelText('Email');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'That does not look like an email address.',
    );
  });
});

describe('PasswordField', () => {
  it('hides what is typed until it is asked to reveal it', async () => {
    const { user } = renderUi(<PasswordField label="Password" />);

    await user.type(password(), 'correct horse battery staple');

    expect(password()).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password()).toHaveAttribute('type', 'text');
    expect(password()).toHaveValue('correct horse battery staple');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(password()).toHaveAttribute('type', 'password');
  });

  it('leaves the focus where it was when reveal is pressed', async () => {
    const { user } = renderUi(
      <>
        <TextField label="Email" />
        <PasswordField label="Password" />
      </>,
    );
    const email = screen.getByLabelText('Email');

    await user.click(email);
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password()).toHaveAttribute('type', 'text');
    expect(email).toHaveFocus();
  });
});
