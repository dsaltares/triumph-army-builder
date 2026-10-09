import { discordClientId, googleClientId } from '../playwright.config.ts';
import {
  accountButton,
  confirmAddress,
  emailField,
  freshEmail,
  inbox,
  pageAlert,
  ready,
  section,
  signInAs,
  signInLink,
  signOut,
  signUp,
  signUpAndIn,
} from './helpers.ts';
import { expect, type Locator, type Page, test } from './test';

const signUpAwaitingConfirmation = async (page: Page, email: string) => {
  await signUp(page, email);
  await expect(inbox(page)).toBeVisible();
};

const wrongPassword = 'That email and password do not match an account.';

test('a player signs up, confirms, signs in, signs out and back in', async ({
  page,
}) => {
  const email = freshEmail();

  await signUp(page, email);

  await expect(inbox(page)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(accountButton(page)).toHaveCount(0);
  await expect(page).toHaveURL('/sign-up');

  await confirmAddress(email);
  await page.goto('/sign-in');
  await signInAs(page, email);

  await expect(page).toHaveURL('/my-armies');
  await accountButton(page).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.keyboard.press('Escape');

  await signOut(page);

  await expect(signInLink(page).first()).toBeVisible();

  await page.goto('/sign-in');
  await signInAs(page, email, 'carthage-must-stand-forever');

  await expect(page.getByText(wrongPassword)).toBeVisible();
  await expect(page).toHaveURL('/sign-in');

  await signInAs(page, email);

  await expect(page).toHaveURL('/my-armies');

  await signOut(page);
  await signUp(page, email, 'a-completely-different-password');

  await expect(inbox(page)).toBeVisible();
  await expect(
    page.getByText(/already (exists|registered|in use)/i),
  ).toHaveCount(0);
});

test('an unconfirmed player is sent back to their inbox, and can ask again', async ({
  page,
}) => {
  const email = freshEmail();
  await signUpAwaitingConfirmation(page, email);

  await page.getByRole('button', { name: 'Send it again' }).click();

  await expect(page.getByText('On its way')).toBeVisible();

  await page.goto('/sign-in');
  await signInAs(page, email);

  await expect(inbox(page)).toBeVisible();
  await expect(page.getByText(wrongPassword)).toHaveCount(0);
});

test('a confirmation link that has run out says so, and can be replaced', async ({
  page,
}) => {
  await page.goto('/sign-in?error=TOKEN_EXPIRED');

  await expect(pageAlert(page)).toContainText(
    'expired or has been used already',
  );
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
});

const topOf = async (target: Locator) => {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('the target is not on the page');
  }
  return box;
};

test('a message appearing moves nothing below it', async ({ page }) => {
  await page.goto('/sign-up');
  await ready(page, 'Create account');
  await emailField(page).click();
  await emailField(page).fill('hannibal');

  const link = page.locator('form').getByRole('link', { name: 'Sign in' });
  const before = await topOf(link);

  await page.getByRole('heading', { name: 'Create account' }).click();

  await expect(
    page.getByText('That does not look like an email address.'),
  ).toBeVisible();
  expect((await topOf(link)).y).toBe(before.y);
});

test('the auth pages send a player who is already signed in onward', async ({
  page,
}) => {
  await signUpAndIn(page, freshEmail());

  await page.goto('/sign-in?next=%2Freference');

  await expect(page).toHaveURL('/reference');

  await page.goto('/sign-up');

  await expect(page).toHaveURL('/my-armies');
});

test('signing in comes back to the page that asked for it', async ({
  page,
}) => {
  const email = freshEmail();
  await signUpAndIn(page, email);
  await signOut(page);

  await page.goto('/reference');
  await signInLink(page).first().click();

  await expect(page).toHaveURL('/sign-in?next=%2Freference');

  await signInAs(page, email);

  await expect(page).toHaveURL('/reference');
  await expect(accountButton(page)).toBeVisible();

  await signOut(page);
  await page.goto('/account');

  await expect(page).toHaveURL('/sign-in?next=%2Faccount');

  await signInAs(page, email);

  await expect(page).toHaveURL('/account');
});

const waysToSignIn = (page: Page) =>
  section(page, 'Ways to sign in').getByRole('listitem');

const wayToSignIn = (page: Page, name: string) =>
  waysToSignIn(page).filter({ hasText: name });

const stubProvider = (page: Page, origin: string) =>
  page.route(`${origin}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html lang="en"><body>the provider</body></html>',
    }),
  );

test('the sign-in page offers every provider the server has credentials for', async ({
  page,
}) => {
  await page.goto('/sign-in');

  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Discord' }),
  ).toBeVisible();
});

test('continuing with Google asks Google for nothing but name and email', async ({
  page,
  baseURL,
}) => {
  await stubProvider(page, 'https://accounts.google.com');
  await page.goto('/sign-in');

  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.waitForURL(/accounts\.google\.com/);

  const asked = new URL(page.url()).searchParams;
  expect(asked.get('client_id')).toBe(googleClientId);
  expect(asked.get('scope')?.split(' ').sort()).toEqual([
    'email',
    'openid',
    'profile',
  ]);
  expect(asked.get('redirect_uri')).toBe(`${baseURL}/api/auth/callback/google`);
});

test('a cancelled provider sign-in says so rather than looking broken', async ({
  page,
}) => {
  await page.goto('/sign-in?error=access_denied');

  await expect(pageAlert(page)).toContainText('cancelled');
});

test('the account page lists every way in, keeps the last one and connects another', async ({
  page,
  baseURL,
}) => {
  await stubProvider(page, 'https://discord.com');
  await signUpAndIn(page, freshEmail());

  await page.goto('/account');

  await expect(wayToSignIn(page, 'Email and password')).toContainText(
    'Connected',
  );
  await expect(wayToSignIn(page, 'Google')).toContainText('Not connected');
  await expect(
    waysToSignIn(page).getByRole('button', { name: 'Disconnect' }),
  ).toHaveCount(0);
  await expect(
    waysToSignIn(page).getByRole('button', { name: 'Connect' }),
  ).toHaveCount(2);

  await wayToSignIn(page, 'Discord')
    .getByRole('button', { name: 'Connect' })
    .click();
  await page.waitForURL(/discord\.com/);

  const asked = new URL(page.url()).searchParams;
  expect(asked.get('client_id')).toBe(discordClientId);
  expect(asked.get('scope')?.split(' ').sort()).toEqual(['email', 'identify']);
  expect(asked.get('redirect_uri')).toBe(
    `${baseURL}/api/auth/callback/discord`,
  );
});
