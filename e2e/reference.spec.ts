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
    .getByRole('link', { name: 'Troop types' })
    .click();

  await expect(page).toHaveURL('/reference/troop-types');
  await expect(page).toHaveTitle('Troop types · Triumph! Army Builder');

  await backToReference(page).click();

  await expect(page).toHaveURL('/reference');

  await page
    .getByRole('main')
    .getByRole('link', { name: 'Battle cards' })
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
