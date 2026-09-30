import { describe, expect, it } from 'vitest';
import { connectedAccounts, type LinkedAccount } from './connected-accounts.ts';

const password: LinkedAccount = { id: 'account-1', providerId: 'credential' };
const google: LinkedAccount = { id: 'account-2', providerId: 'google' };
const discord: LinkedAccount = { id: 'account-3', providerId: 'discord' };

const both = ['google', 'discord'] as const;

const named = (accounts: readonly { providerId: string }[]) =>
  accounts.map(({ providerId }) => providerId);

describe('connectedAccounts', () => {
  it('offers every configured provider, connected or not', () => {
    const rows = connectedAccounts([password], both);

    expect(named(rows)).toEqual(['credential', 'google', 'discord']);
    expect(rows.map(({ connected }) => connected)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('names a provider the way a player would', () => {
    expect(connectedAccounts([password], both).map(({ name }) => name)).toEqual(
      ['Email and password', 'Google', 'Discord'],
    );
  });

  it('leaves out a provider the deployment has not configured', () => {
    expect(named(connectedAccounts([password], ['google']))).toEqual([
      'credential',
      'google',
    ]);
  });

  it('offers to connect a provider that is not linked yet', () => {
    const [, unlinked] = connectedAccounts([password], both);

    expect(unlinked?.action).toEqual({ kind: 'connect' });
  });

  it('offers to disconnect a linked provider, naming the row to delete', () => {
    const [, linked] = connectedAccounts([password, google], both);

    expect(linked?.action).toEqual({
      kind: 'disconnect',
      accountId: google.id,
    });
  });

  it('never offers to disconnect the only way in', () => {
    expect(connectedAccounts([google], both)[1]?.action).toBeUndefined();
    expect(connectedAccounts([password], both)[0]?.action).toBeUndefined();
  });

  it('never offers to disconnect the password, which has no way back', () => {
    const [credential] = connectedAccounts([password, google], both);

    expect(credential?.connected).toBe(true);
    expect(credential?.action).toBeUndefined();
  });

  it('offers a password to an account that has never had one', () => {
    const rows = connectedAccounts([google], both);

    expect(named(rows)).toEqual(['credential', 'google', 'discord']);
    expect(rows[0]).toMatchObject({
      connected: false,
      action: { kind: 'set-password' },
    });
  });

  it('still shows an account whose provider is no longer configured', () => {
    const rows = connectedAccounts([password, discord], ['google']);

    expect(named(rows)).toEqual(['credential', 'google', 'discord']);
    expect(rows[2]).toEqual({
      providerId: 'discord',
      name: 'Discord',
      connected: true,
      action: { kind: 'disconnect', accountId: discord.id },
    });
  });

  it('names an unknown provider by its id rather than hiding it', () => {
    const rows = connectedAccounts(
      [password, { id: 'account-9', providerId: 'github' }],
      [],
    );

    expect(rows[1]).toEqual({
      providerId: 'github',
      name: 'github',
      connected: true,
      action: { kind: 'disconnect', accountId: 'account-9' },
    });
  });

  it('offers nothing at all to a player with no accounts', () => {
    expect(connectedAccounts([], [])).toEqual([]);
  });
});
