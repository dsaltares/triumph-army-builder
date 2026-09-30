import { describe, expect, it } from 'vitest';
import {
  alreadyRegisteredEmail,
  alreadyRegisteredSubject,
} from './already-registered.tsx';

const signInUrl = 'https://triumph.example.test/sign-in';
const resetUrl = 'https://triumph.example.test/forgot-password';

const message = () =>
  alreadyRegisteredEmail({ to: 'player@example.test', signInUrl, resetUrl });

describe('alreadyRegisteredEmail', () => {
  it('addresses the recipient with the already-registered subject', async () => {
    const { to, subject } = await message();

    expect(to).toBe('player@example.test');
    expect(subject).toBe(alreadyRegisteredSubject('en'));
  });

  it('offers signing in from the button and from the fallback', async () => {
    const { html } = await message();

    expect(html).toContain('Sign in instead');
    expect(html.split(`href="${signInUrl}"`)).toHaveLength(3);
  });

  it('offers a new password without carrying a token of its own', async () => {
    const { html } = await message();

    expect(html).toContain(resetUrl);
    expect(html).not.toContain('token=');
  });

  it('says no second account was made and no password changed', async () => {
    const { text } = await message();

    expect(text).toContain('No second account was made');
    expect(text).toContain('your password is untouched');
    expect(text).not.toContain('<');
  });
});
