import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { armyId, section } from './helpers';

const openArmy = async (page: Page, request: APIRequestContext, name: string) =>
  page.goto(`/armies/${await armyId(request, name)}`);

test('a prerendered army list is laid out in the rulebook sections, and titled', async ({
  page,
  request,
}) => {
  await openArmy(page, request, 'Iron Crown Knights');

  await expect(page).toHaveTitle('Iron Crown Knights · Triumph! Army Builder');
  await expect(
    page.getByRole('heading', { name: 'Iron Crown Knights', level: 1 }),
  ).toBeVisible();
  for (const heading of [
    'Required Troops',
    'Optional Contingents',
    'Ally Troop Options',
    'Battle Cards',
    'Enemies',
    'Related Lists',
  ]) {
    await expect(
      page.getByRole('heading', { name: heading, level: 2 }),
    ).toBeVisible();
  }
});

test('an army leads to the lists it is matched against, and back to the index', async ({
  page,
  request,
}) => {
  await openArmy(page, request, 'Iron Crown Knights');

  await section(page, 'Enemies')
    .getByRole('link', { name: 'Sylvan Courts' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Sylvan Courts', level: 1 }),
  ).toBeVisible();
  await expect(
    section(page, 'Enemies').getByRole('link', { name: 'Iron Crown Knights' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'All armies' }).click();

  await expect(page).toHaveURL('/armies');
});

test('an army the data bundle does not hold is a 404', async ({ page }) => {
  const response = await page.goto('/armies/not-an-army');

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found', level: 1 }),
  ).toBeVisible();
});
