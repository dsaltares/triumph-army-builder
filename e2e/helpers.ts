import { randomUUID } from 'node:crypto';
import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { createDatabase } from '../lib/db/client.ts';
import { e2eDatabaseUrl } from '../playwright.config.ts';

type Named = { id: string; name: string };

const referenceRead = async (request: APIRequestContext, procedure: string) => {
  const input = encodeURIComponent(JSON.stringify({ locale: 'en' }));
  const response = await request.get(
    `/api/trpc/reference.${procedure}?input=${input}`,
  );
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { result: { data: unknown } }).result.data;
};

const namedId = async (
  request: APIRequestContext,
  procedure: string,
  read: (body: unknown) => Named[],
  what: string,
  name: string,
) => {
  const found = read(await referenceRead(request, procedure)).find(
    (candidate) => candidate.name === name,
  );
  if (!found) {
    throw new Error(`the reference data holds no ${what} named ${name}`);
  }
  return found.id;
};

export const armyId = (request: APIRequestContext, name: string) =>
  namedId(
    request,
    'index',
    (body) => (body as { armies: Named[] }).armies,
    'army',
    name,
  );

export const categoryId = (request: APIRequestContext, name: string) =>
  namedId(
    request,
    'thematicCategories',
    (body) => body as Named[],
    'category',
    name,
  );

export const section = (page: Page, name: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name, level: 2 }) });

export const confirmAddress = async (email: string) => {
  const db = createDatabase(e2eDatabaseUrl);
  try {
    const confirmed = await db
      .updateTable('users')
      .set({ emailVerified: 1 })
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst();
    if (confirmed.numUpdatedRows === 0n) {
      throw new Error(
        `no account was signed up with ${email} in ${e2eDatabaseUrl} — a server started by hand writes to its own DATABASE_URL, and Playwright reuses it`,
      );
    }
  } finally {
    await db.destroy();
  }
};

export const password = 'elephants-over-the-alps';

export const freshEmail = () => `hannibal-${randomUUID()}@example.test`;

export const emailField = (page: Page) => page.getByLabel('Email');

export const passwordField = (page: Page) =>
  page.getByLabel('Password', { exact: true });

export const repeatField = (page: Page) => page.getByLabel('Repeat password');

export const ready = (page: Page, submit: string) =>
  expect(page.getByRole('button', { name: submit, exact: true })).toBeEnabled();

export const inbox = (page: Page) =>
  page.getByText('Confirm your address to finish');

export const accountButton = (page: Page) =>
  page.getByRole('button', { name: 'Account' });

export const signInLink = (page: Page) =>
  page.getByRole('link', { name: 'Sign in' });

export const signUp = async (page: Page, email: string, secret = password) => {
  await page.goto('/sign-up');
  await ready(page, 'Create account');
  await emailField(page).fill(email);
  await passwordField(page).fill(secret);
  await repeatField(page).fill(secret);
  await page.getByRole('button', { name: 'Create account' }).click();
};

export const signInAs = async (
  page: Page,
  email: string,
  secret = password,
) => {
  await ready(page, 'Sign in');
  await emailField(page).fill(email);
  await passwordField(page).fill(secret);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
};

export const signUpAndIn = async (page: Page, email: string) => {
  await signUp(page, email);
  await expect(inbox(page)).toBeVisible();
  await confirmAddress(email);
  await page.goto('/sign-in');
  await signInAs(page, email);
  await expect(page).toHaveURL('/my-armies');
};

export const signOut = async (page: Page) => {
  await expect(accountButton(page)).toBeVisible();
  await accountButton(page).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/my-armies');
};

export const pageAlert = (page: Page) =>
  page.getByRole('main').getByRole('alert');
