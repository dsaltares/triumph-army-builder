import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { formatEnvFile, localEnvironment, localUrl } from './local-env.ts';

describe('localEnvironment', () => {
  it('points the auth URL and the database at this machine', () => {
    expect(
      localEnvironment(
        {
          BETTER_AUTH_URL: 'https://triumph.example.com',
          DATABASE_URL: '/data/db.sqlite',
          BETTER_AUTH_SECRET: 'production-secret',
        },
        {},
        '.data/db.sqlite',
      ),
    ).toEqual({
      BETTER_AUTH_URL: localUrl,
      DATABASE_URL: '.data/db.sqlite',
      BETTER_AUTH_SECRET: 'production-secret',
    });
  });

  it('drops what only means something in the container', () => {
    expect(
      localEnvironment(
        {
          NODE_ENV: 'production',
          REFERENCE_PACK: '/app/reference/pack.json.gz',
          TRUSTED_PROXIES: '172.16.0.0/12',
          RESEND_API_KEY: 're_123',
        },
        {},
        '.data/db.sqlite',
      ),
    ).toEqual({
      RESEND_API_KEY: 're_123',
      DATABASE_URL: '.data/db.sqlite',
      BETTER_AUTH_URL: localUrl,
    });
  });

  it('keeps local settings production does not have, and takes production over the rest', () => {
    expect(
      localEnvironment(
        { GOOGLE_CLIENT_ID: 'production', EMPTY: null },
        { GOOGLE_CLIENT_ID: 'local', REFERENCE_PACK_TOKEN: 'ghp_local' },
        '.data/db.sqlite',
      ),
    ).toMatchObject({
      GOOGLE_CLIENT_ID: 'production',
      REFERENCE_PACK_TOKEN: 'ghp_local',
    });
  });
});

describe('formatEnvFile', () => {
  it('writes values the env file parser reads back unchanged', () => {
    const environment = {
      BARE: 'http://localhost:3013',
      SPACES: 'Triumph! Army Builder <noreply@example.com>',
      HASH: 'a#b',
      APOSTROPHE: "it's",
      EMPTY: '',
    };

    expect(parseEnv(formatEnvFile(environment))).toEqual(environment);
  });

  it('refuses a $, which Next would expand and Node would not', () => {
    expect(() =>
      formatEnvFile({ BETTER_AUTH_SECRET: 'p$ss', RESEND_API_KEY: 're_123' }),
    ).toThrow(/^BETTER_AUTH_SECRET hold a \$/);
  });
});
