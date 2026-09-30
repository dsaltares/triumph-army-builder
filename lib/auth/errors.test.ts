import { describe, expect, it } from 'vitest';
import { wordsFor } from '../i18n/translator.ts';
import {
  authErrorKey,
  expiredConfirmationLinkKey,
  expiredResetLinkKey,
  genericAuthKey,
  oauthCancelledKey,
  rateLimitedKey,
  redirectErrorKey,
  unverifiedAddressKey,
} from './errors.ts';

const en = wordsFor('en', 'auth');
const es = wordsFor('es', 'auth');

describe('authErrorKey', () => {
  it('answers a bad sign-in without saying which half was wrong', () => {
    expect(authErrorKey({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      authErrorKey({ code: 'USER_NOT_FOUND' }),
    );
  });

  it('falls back to one message for anything it does not know', () => {
    expect(authErrorKey({ code: 'SOMETHING_NEW' })).toBe(genericAuthKey);
    expect(authErrorKey(undefined)).toBe(genericAuthKey);
  });

  it('never names an address as registered', () => {
    expect(authErrorKey({ code: 'USER_ALREADY_EXISTS' })).toBe(genericAuthKey);
    expect(
      authErrorKey({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }),
    ).toBe(genericAuthKey);
  });

  it('sends a spent reset link back for a new one', () => {
    expect(authErrorKey({ code: 'INVALID_TOKEN' })).toBe(expiredResetLinkKey);
  });

  it('says to wait when a limit answered, whichever limit it was', () => {
    expect(authErrorKey({ status: 429 })).toBe(rateLimitedKey);
    expect(authErrorKey({ code: 'TOO_MANY_RESET_REQUESTS', status: 429 })).toBe(
      rateLimitedKey,
    );
    expect(
      authErrorKey({ code: 'TOO_MANY_CONFIRMATION_REQUESTS', status: 429 }),
    ).toBe(rateLimitedKey);
  });

  it('sends an unconfirmed player to their inbox rather than to support', () => {
    expect(authErrorKey({ code: 'EMAIL_NOT_VERIFIED' })).toBe(
      unverifiedAddressKey,
    );
    expect(en(unverifiedAddressKey)).toMatch(/inbox/);
    expect(es(unverifiedAddressKey)).toMatch(/bandeja de entrada/);
  });

  it('says why the last way in cannot be removed', () => {
    expect(en(authErrorKey({ code: 'FAILED_TO_UNLINK_LAST_ACCOUNT' }))).toMatch(
      /only way you can sign in/,
    );
  });

  it('asks for a fresh session rather than failing silently', () => {
    expect(en(authErrorKey({ code: 'SESSION_NOT_FRESH' }))).toMatch(
      /Sign out and back in/,
    );
  });
});

describe('redirectErrorKey', () => {
  it('says a cancelled sign-in was cancelled, not that something broke', () => {
    expect(redirectErrorKey('access_denied')).toBe(oauthCancelledKey);
  });

  it('sends a refused link back to the way the account was made', () => {
    expect(en(redirectErrorKey('account_not_linked'))).toMatch(
      /sign in the way you created this one/i,
    );
  });

  it('explains a mismatched address without naming the other one', () => {
    const key = redirectErrorKey('email_does_not_match');

    expect(en(key)).toMatch(/different email address/);
    expect(en(key)).not.toMatch(/@/);
    expect(es(key)).not.toMatch(/@/);
  });

  it('offers a new confirmation link when the old one has run out', () => {
    expect(redirectErrorKey('TOKEN_EXPIRED')).toBe(expiredConfirmationLinkKey);
    expect(redirectErrorKey('INVALID_TOKEN')).toBe(expiredConfirmationLinkKey);
  });

  it('keeps the confirmation link and the reset link apart', () => {
    expect(en(expiredConfirmationLinkKey)).toMatch(/confirmation link/);
    expect(en(expiredResetLinkKey)).toMatch(/reset link/);
    expect(es(expiredConfirmationLinkKey)).toMatch(/confirmación/);
    expect(es(expiredResetLinkKey)).toMatch(/restablecimiento/);
  });

  it('falls back to one message for anything it does not know', () => {
    expect(redirectErrorKey('something_new')).toBe(genericAuthKey);
    expect(redirectErrorKey(null)).toBe(genericAuthKey);
    expect(redirectErrorKey(undefined)).toBe(genericAuthKey);
  });
});
