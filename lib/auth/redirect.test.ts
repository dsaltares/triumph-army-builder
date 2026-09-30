import { describe, expect, it } from 'vitest';
import { routes } from '../navigation.ts';
import { afterAuthPath, authUrl } from './redirect.ts';

describe('afterAuthPath', () => {
  it('returns to where the player came from', () => {
    expect(afterAuthPath('/armies/66c')).toBe('/armies/66c');
  });

  it('lands on My Armies when nothing asked for somewhere else', () => {
    expect(afterAuthPath(null)).toBe(routes.myArmies);
    expect(afterAuthPath('')).toBe(routes.myArmies);
  });

  it('refuses to be turned into an open redirect', () => {
    expect(afterAuthPath('https://evil.test')).toBe(routes.myArmies);
    expect(afterAuthPath('//evil.test')).toBe(routes.myArmies);
  });
});

describe('authUrl', () => {
  it('carries the current path so signing in comes back to it', () => {
    expect(authUrl(routes.signIn, '/armies/66c')).toBe(
      '/sign-in?next=%2Farmies%2F66c',
    );
  });

  it('does not ask to come back to the auth pages themselves', () => {
    expect(authUrl(routes.signUp, routes.signIn)).toBe(routes.signUp);
    expect(authUrl(routes.signIn, routes.signUp)).toBe(routes.signIn);
    expect(authUrl(routes.signIn, routes.forgotPassword)).toBe(routes.signIn);
    expect(authUrl(routes.signIn, routes.resetPassword)).toBe(routes.signIn);
  });

  it('drops anything that is not an internal path', () => {
    expect(authUrl(routes.signIn, 'https://evil.test')).toBe(routes.signIn);
    expect(authUrl(routes.signIn)).toBe(routes.signIn);
  });
});
