import { randomUUID } from 'node:crypto';
import { pageAlert, ready } from './helpers.ts';
import { expect, type Page, test } from './test';

const freshEmail = () => `hannibal-${randomUUID()}@example.test`;

const emailField = (page: Page) => page.getByLabel('Email');

const passwordField = (page: Page) =>
  page.getByLabel('Password', { exact: true });

const repeatField = (page: Page) => page.getByLabel('Repeat password');

test('asking for a link says nothing about who has an account', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await ready(page, 'Sign in');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();

  await expect(page).toHaveURL('/forgot-password');
  await ready(page, 'Email me a link');

  await emailField(page).fill(freshEmail());
  await page.getByRole('button', { name: 'Email me a link' }).click();

  await expect(pageAlert(page)).toContainText(
    'If that address has an account, a link to choose a password',
  );
  await expect(
    page.getByText(/no account|not registered|unknown/i),
  ).toHaveCount(0);
});

test('a token nobody minted is refused with a way back', async ({ page }) => {
  await page.goto('/reset-password?token=not-a-token-anybody-minted');
  await ready(page, 'Save new password');

  await passwordField(page).fill('the-alps-were-the-easy-part');
  await repeatField(page).fill('the-alps-were-the-easy-part');
  await page.getByRole('button', { name: 'Save new password' }).click();

  await expect(pageAlert(page)).toContainText(
    'That reset link has expired or has already been used.',
  );
  await expect(
    page.getByRole('link', { name: 'Ask for a new link' }),
  ).toBeVisible();
});
