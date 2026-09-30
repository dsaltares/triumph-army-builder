import { expect, type Page, test } from '@playwright/test';
import { fixtureSelection } from '../test/fixtures/army.ts';
import {
  accountButton,
  freshEmail,
  signInLink,
  signOut,
  signUpAndIn,
} from './helpers.ts';

const sessionCookie = async (page: Page) =>
  (await page.context().cookies()).find(({ name }) =>
    name.includes('session_token'),
  );

const startAnonymously = async (page: Page) => {
  const response = await page.request.post('/api/auth/sign-in/anonymous', {
    data: {},
  });
  expect(response.ok()).toBeTruthy();
};

const save = async (page: Page, name: string) => {
  const response = await page.request.post('/api/trpc/army.create', {
    data: { name, selection: fixtureSelection() },
  });
  expect(response.ok()).toBeTruthy();
};

const savedNames = async (page: Page) => {
  const response = await page.request.get('/api/trpc/army.list');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    result: { data: { name: string }[] };
  };
  return body.result.data.map(({ name }) => name);
};

const claimNotice = (page: Page) =>
  page.getByText('2 lists from this browser were added to your account');

test('a browser keeps lists without an account, and an account claims them', async ({
  page,
}) => {
  await page.goto('/armies');
  await page.goto('/my-armies');

  expect(await sessionCookie(page)).toBeUndefined();
  expect(await savedNames(page)).toEqual([]);

  await startAnonymously(page);
  await save(page, 'Cannae');
  await save(page, 'Trebia');
  await page.reload();

  expect(await sessionCookie(page)).toBeDefined();
  await expect(signInLink(page).first()).toBeVisible();
  await expect(accountButton(page)).toHaveCount(0);

  await signUpAndIn(page, freshEmail());

  await expect(claimNotice(page)).toBeVisible();
  expect(await savedNames(page)).toEqual(['Trebia', 'Cannae']);

  await page.goto('/armies');

  await expect(claimNotice(page)).toHaveCount(0);

  await signOut(page);
  await expect(signInLink(page).first()).toBeVisible();

  expect(await sessionCookie(page)).toBeUndefined();
  expect(await savedNames(page)).toEqual([]);
});
