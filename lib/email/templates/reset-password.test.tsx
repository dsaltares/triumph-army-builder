import { describe, expect, it } from 'vitest';
import { resetPasswordEmail, resetPasswordSubject } from './reset-password.tsx';

const url = 'https://triumph.example.test/reset-password?token=abc123';

describe('resetPasswordEmail', () => {
  it('addresses the recipient with the reset subject', async () => {
    const message = await resetPasswordEmail({
      to: 'player@example.test',
      url,
    });

    expect(message.to).toBe('player@example.test');
    expect(message.subject).toBe(resetPasswordSubject('en'));
  });

  it('links the reset url from the button and from the fallback', async () => {
    const { html } = await resetPasswordEmail({
      to: 'player@example.test',
      url,
    });

    expect(html).toContain('Choose a new password');
    expect(html.split(`href="${url}"`)).toHaveLength(3);
  });

  it('words the link as adding a password for an account that has none', async () => {
    const { subject, html } = await resetPasswordEmail({
      to: 'player@example.test',
      url,
      purpose: 'set',
    });

    expect(subject).toBe(resetPasswordSubject('en', 'set'));
    expect(html).toContain('Choose a password');
    expect(html).not.toContain('Choose a new password');
    expect(html.split(`href="${url}"`)).toHaveLength(3);
  });

  it('writes the whole mail in the locale it is given', async () => {
    const { subject, html, text } = await resetPasswordEmail({
      to: 'player@example.test',
      url,
      locale: 'es',
    });

    expect(subject).toBe(resetPasswordSubject('es'));
    expect(html).toContain('lang="es"');
    expect(html).toContain('Elegir una contraseña nueva');
    expect(html).not.toContain('Choose a new password');
    expect(text).toContain('caduca en una hora');
  });

  it('carries the url and the expiry in the plain text part', async () => {
    const { text } = await resetPasswordEmail({
      to: 'player@example.test',
      url,
    });

    expect(text).toContain(url);
    expect(text).toContain('expires in an hour');
    expect(text).not.toContain('<');
  });
});
