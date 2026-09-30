import { describe, expect, it } from 'vitest';
import { isAnonymousSession, isSignedIn } from './session.ts';

const anonymous = { user: { isAnonymous: true } };
const account = { user: { isAnonymous: false } };
const unflagged = { user: {} };

describe('isAnonymousSession', () => {
  it('knows the session a browser was given without signing up', () => {
    expect(isAnonymousSession(anonymous)).toBe(true);
  });

  it('treats an account, a missing flag and no session as not anonymous', () => {
    expect(isAnonymousSession(account)).toBe(false);
    expect(isAnonymousSession(unflagged)).toBe(false);
    expect(isAnonymousSession(null)).toBe(false);
    expect(isAnonymousSession(undefined)).toBe(false);
  });
});

describe('isSignedIn', () => {
  it('is true only for a session belonging to an account', () => {
    expect(isSignedIn(account)).toBe(true);
    expect(isSignedIn(unflagged)).toBe(true);
  });

  it('counts an anonymous session as signed out, because it is', () => {
    expect(isSignedIn(anonymous)).toBe(false);
  });

  it('counts no session at all as signed out', () => {
    expect(isSignedIn(null)).toBe(false);
    expect(isSignedIn(undefined)).toBe(false);
  });
});
