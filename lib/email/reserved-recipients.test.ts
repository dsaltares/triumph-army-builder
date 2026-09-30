import { describe, expect, it } from 'vitest';
import { isReservedRecipient } from './reserved-recipients.ts';

describe('isReservedRecipient', () => {
  it.each([
    'hannibal-6aac1ad8@example.test',
    'player@example.com',
    'player@example.net',
    'player@example.org',
    'player@something.example',
    'player@nowhere.invalid',
    'player@localhost',
    'player@box.localhost',
    'PLAYER@EXAMPLE.TEST',
    '  player@example.test  ',
  ])('holds back %s, which no real mailbox can receive', (address) => {
    expect(isReservedRecipient(address)).toBe(true);
  });

  it.each([
    'player@triumph.saltares.dev',
    'player@gmail.com',
    'player@example.testing.dev',
    'player@testmail.dev',
    'player+test@saltares.dev',
  ])('lets %s through', (address) => {
    expect(isReservedRecipient(address)).toBe(false);
  });

  it('lets an address with no domain through, for the transport to reject', () => {
    expect(isReservedRecipient('not-an-address')).toBe(false);
  });
});
