import { describe, expect, it } from 'vitest';
import { verifyAddressEmail, verifyAddressSubject } from './verify-address.tsx';

const url =
  'https://triumph.example.test/api/auth/verify-email?token=abc123&callbackURL=%2Fsign-in';

describe('verifyAddressEmail', () => {
  it('addresses the recipient with the confirmation subject', async () => {
    const message = await verifyAddressEmail({
      to: 'player@example.test',
      url,
    });

    expect(message.to).toBe('player@example.test');
    expect(message.subject).toBe(verifyAddressSubject('en'));
  });

  it('links the confirmation url from the button and from the fallback', async () => {
    const { html } = await verifyAddressEmail({
      to: 'player@example.test',
      url,
    });
    const escaped = url.replaceAll('&', '&amp;');

    expect(html).toContain('Confirm my address');
    expect(html.split(`href="${escaped}"`)).toHaveLength(3);
  });

  it('carries the url and the expiry in the plain text part', async () => {
    const { text } = await verifyAddressEmail({
      to: 'player@example.test',
      url,
    });

    expect(text).toContain(url);
    expect(text).toContain('expires in an hour');
    expect(text).not.toContain('<');
  });

  it('tells someone who did not ask that the account is unusable until they do', async () => {
    const { text } = await verifyAddressEmail({
      to: 'player@example.test',
      url,
    });

    expect(text).toMatch(/nobody can use the account/);
  });
});
