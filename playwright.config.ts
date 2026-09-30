import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { devUser } from './lib/db/dev-user.ts';

const isCI = !!process.env.CI;
const port = Number(process.env.E2E_PORT) || 3099;
const againstDevServer = process.env.E2E_SERVER === 'dev';
const baseURL = `http://localhost:${port}`;

const mobileOnly = /mobile\.spec\.ts$/;

export const e2eDatabaseUrl = '.data/e2e.sqlite';

// Every worker loads this file again, and inherits the runner's environment,
// so the directory is made once per run and carried to them through it.
process.env.E2E_PHOTO_DIR ??= mkdtempSync(
  join(tmpdir(), 'triumph-e2e-photos-'),
);

export const e2ePhotoDir = process.env.E2E_PHOTO_DIR;

export const e2eDistDir = '.next-e2e';

// next dev rewrites its prerender manifest in place and compiles each route
// on its first request, so under parallel workers a request reads the
// manifest half-written or a navigation outlasts its assertion. A production
// build does neither, which is why it is the default and dev is opt-in.
const serverCommand = againstDevServer
  ? `yarn next dev --port ${port}`
  : `yarn next build && yarn next start --port ${port}`;

export const googleClientId = 'an-e2e-google-client-id';
export const discordClientId = 'an-e2e-discord-client-id';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // The proxy negotiates a locale from Accept-Language when there is no
    // cookie, so without pinning it every English assertion in this suite
    // would quietly depend on the machine running it.
    locale: 'en-GB',
    extraHTTPHeaders: { 'Accept-Language': 'en' },
  },
  projects: [
    {
      name: 'desktop-chrome',
      testIgnore: mobileOnly,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: mobileOnly,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: e2eDistDir,
      DATABASE_URL: e2eDatabaseUrl,
      PHOTO_DIR: e2ePhotoDir,
      DISABLE_AUTH_RATE_LIMIT: '1',
      ADMIN_EMAILS: devUser.email,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: 'a-throwaway-secret-only-the-e2e-server-signs-with',
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
      GOOGLE_CLIENT_ID: googleClientId,
      GOOGLE_CLIENT_SECRET: 'an-e2e-google-client-secret',
      DISCORD_CLIENT_ID: discordClientId,
      DISCORD_CLIENT_SECRET: 'an-e2e-discord-client-secret',
    },
  },
});
