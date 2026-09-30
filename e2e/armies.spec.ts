import { expect, type Page, test } from '@playwright/test';

const searchBox = (page: Page) =>
  page.getByRole('searchbox', { name: 'Search army lists' });

const summary = (page: Page, text: string) =>
  page.getByText(text, { exact: true });

const loaded = (page: Page, text = '8 army lists') =>
  expect(summary(page, text)).toBeVisible();

const openFilters = async (page: Page) => {
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
};

const chip = (page: Page, group: string, label: string) =>
  page.getByRole('group', { name: group }).getByRole('button', { name: label });

test('the index loads every army list', async ({ page }) => {
  await page.goto('/armies');

  await loaded(page);
  await expect(
    page.getByRole('heading', { name: 'Sunspire Dominion', level: 2 }),
  ).toBeVisible();
});

test('the filters live in the url, and survive walking into an army and back', async ({
  page,
}) => {
  await page.goto('/armies');
  await loaded(page);

  await searchBox(page).fill('tidewrack');
  await openFilters(page);
  await chip(page, 'Home topography', 'Delta').click();
  await page.getByRole('button', { name: /^Show \d+ (army|armies)$/ }).click();

  await expect(page).toHaveURL(
    /\?(?=.*\bq=tidewrack\b)(?=.*\btopography=Delta\b)/,
  );

  await page.getByRole('link', { name: /^Tidewrack Corsairs/ }).click();

  await expect(
    page.getByRole('heading', { name: 'Tidewrack Corsairs', level: 1 }),
  ).toBeVisible();

  await page.goBack();

  await expect(searchBox(page)).toHaveValue('tidewrack');
  await expect(page.getByRole('button', { name: 'Filters 1' })).toBeVisible();
  await loaded(page, '1 of 8 army lists');
});

test('a filtered url opens on the same armies, with the filters marked', async ({
  page,
}) => {
  await page.goto('/armies?topography=Arable&invasion=2');

  await expect(summary(page, '2 of 8 army lists')).toBeVisible();

  await openFilters(page);

  await expect(chip(page, 'Home topography', 'Arable')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(chip(page, 'Invasion rating', '2')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('clearing the filters empties the url again', async ({ page }) => {
  await page.goto('/armies?q=zzzz&topography=Arable');

  await page.getByRole('button', { name: 'Clear search and filters' }).click();

  await expect(page).toHaveURL('/armies');
  await loaded(page);
});
