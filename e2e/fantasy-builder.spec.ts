import { expect, type Page, test } from '@playwright/test';
import { section } from './helpers';

const saveStatus = (page: Page) =>
  page.getByRole('status', { name: 'Save status' });

const savedRow = (page: Page, name: string) =>
  page.getByRole('row').filter({ hasText: name }).first();

test('a Fantasy Triumph list is built from the home page and kept in My Armies', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'My Armies' }).first().click();
  await page.getByRole('button', { name: /first list|New list/ }).click();

  const newList = page.getByRole('dialog');
  await newList.getByRole('button', { name: /^Fantasy Triumph/ }).click();
  await newList.getByRole('textbox', { name: 'List name' }).fill('Goblin raid');
  await newList.getByRole('spinbutton', { name: 'Points total' }).fill('36');
  await newList.getByRole('button', { name: 'Start list' }).click();

  await expect(page).toHaveURL(/\/fantasy\/build\?list=/);
  await expect(page).toHaveTitle(
    'Build a Fantasy Triumph list · Triumph! Army Builder',
  );
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });

  const units = section(page, 'Units');
  await units.getByRole('button', { name: 'Add unit' }).click();
  await units.getByRole('textbox', { name: 'Unit name' }).fill('Warg riders');
  await units
    .getByRole('combobox', { name: 'Troop type' })
    .fill('Javelin Cavalry');
  await page.getByRole('option', { name: / · Javelin Cavalry$/ }).click();
  await units
    .getByRole('button', { name: 'One more stand of Warg riders' })
    .click();

  await expect(
    section(page, 'General').getByRole('radio', { name: 'Warg riders' }),
  ).toBeChecked();
  await expect(saveStatus(page)).toContainText('Saved');

  await page.reload();

  await expect(page.getByRole('textbox', { name: 'List name' })).toHaveValue(
    'Goblin raid',
  );
  await expect(
    section(page, 'Units').getByRole('textbox', { name: 'Unit name' }),
  ).toHaveValue('Warg riders');

  await page.getByRole('link', { name: 'My Armies' }).first().click();

  await expect(savedRow(page, 'Goblin raid')).toContainText('Fantasy Triumph');
  await expect(savedRow(page, 'Goblin raid')).toContainText('8 / 36');
});
