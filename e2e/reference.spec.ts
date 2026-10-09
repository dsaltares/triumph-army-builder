import { expect, type Page, test } from '@playwright/test';

const primaryNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Primary' });

const backToReference = (page: Page) =>
  page.getByRole('main').getByRole('link', { name: 'Reference' });

test('the reference hub leads to both pages and back, each titled', async ({
  page,
}) => {
  await page.goto('/reference');

  await page
    .getByRole('main')
    .getByRole('link', { name: /^Troop types/ })
    .click();

  await expect(page).toHaveURL('/reference/troop-types');
  await expect(page).toHaveTitle('Troop types · Triumph! Army Builder');

  await backToReference(page).click();

  await expect(page).toHaveURL('/reference');

  await page
    .getByRole('main')
    .getByRole('link', { name: /^Battle cards/ })
    .click();

  await expect(page).toHaveURL('/reference/battle-cards');
  await expect(page).toHaveTitle('Battle cards · Triumph! Army Builder');
});

test('the reference pages stay under the Reference nav section', async ({
  page,
}) => {
  await page.goto('/reference/battle-cards');

  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.count()) {
    await menu.click();
  }

  await expect(
    primaryNav(page).getByRole('link', { name: 'Reference', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('the Fantasy Triumph pages sit in the reference under their own names', async ({
  page,
  request,
}) => {
  await page.goto('/reference');

  await page
    .getByRole('main')
    .getByRole('link', { name: 'Fantasy Triumph troop types' })
    .click();

  await expect(page).toHaveURL('/fantasy/troop-types');
  await expect(page).toHaveTitle(
    'Fantasy Triumph troop types · Triumph! Army Builder',
  );
  await expect(page.getByText('Shooters', { exact: true })).toBeVisible();
  await expect(page.getByText('Behemoths', { exact: true })).toBeVisible();
  await expect(page.getByText('Archers', { exact: true })).toHaveCount(0);

  await backToReference(page).click();
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Fantasy Triumph battle cards' })
    .click();

  await expect(page).toHaveURL('/fantasy/battle-cards');
  await expect(page).toHaveTitle(
    'Fantasy Triumph battle cards · Triumph! Army Builder',
  );
  const image = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content');
  const imageResponse = await request.get(image ?? '');
  expect(imageResponse.ok()).toBe(true);
  expect(imageResponse.headers()['content-type']).toBe('image/png');

  await page.getByRole('heading', { name: 'Brittle', level: 3 }).click();
  await expect(page.getByText('Bow Levy or Shooters: -1 point')).toBeVisible();

  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.count()) {
    await menu.click();
  }
  await expect(
    primaryNav(page).getByRole('link', { name: 'Reference', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('the Triumph! troop types keep their own names', async ({ page }) => {
  await page.goto('/reference/troop-types');

  await expect(page.getByText('Archers', { exact: true })).toBeVisible();
  await expect(page.getByText('Elephants', { exact: true })).toBeVisible();
  await expect(page.getByText('Shooters', { exact: true })).toHaveCount(0);
});
