import { describe, expect, it } from 'vitest';
import { configuredSocialProviders, socialProviders } from './social.ts';

const both = {
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  DISCORD_CLIENT_ID: 'discord-id',
  DISCORD_CLIENT_SECRET: 'discord-secret',
};

describe('socialProviders', () => {
  it('registers nothing when the environment names no credentials', () => {
    expect(socialProviders({})).toEqual({});
    expect(configuredSocialProviders({})).toEqual([]);
  });

  it('registers a provider whose id and secret are both there', () => {
    expect(socialProviders(both)).toEqual({
      google: { clientId: 'google-id', clientSecret: 'google-secret' },
      discord: { clientId: 'discord-id', clientSecret: 'discord-secret' },
    });
    expect(configuredSocialProviders(both)).toEqual(['google', 'discord']);
  });

  it('leaves out a provider that has an id but no secret', () => {
    const half = { ...both, DISCORD_CLIENT_SECRET: '' };

    expect(Object.keys(socialProviders(half))).toEqual(['google']);
    expect(configuredSocialProviders(half)).toEqual(['google']);
  });

  it('leaves out a provider that has a secret but no id', () => {
    const half = { ...both, GOOGLE_CLIENT_ID: undefined };

    expect(Object.keys(socialProviders(half))).toEqual(['discord']);
    expect(configuredSocialProviders(half)).toEqual(['discord']);
  });

  it('offers Google before Discord, so the universal default comes first', () => {
    expect(configuredSocialProviders(both)).toEqual(['google', 'discord']);
  });
});
