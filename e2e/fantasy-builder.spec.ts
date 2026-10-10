import { section } from './helpers';
import { expect, type Page, test } from './test';

const saveStatus = (page: Page) =>
  page.getByRole('status', { name: 'Save status' });

const savedRow = (page: Page, name: string) =>
  page.getByRole('row').filter({ hasText: name }).first();

const shareLink = async (page: Page) => {
  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: 'Share link' }).click();
  const dialog = page.getByRole('dialog');
  const link = dialog.getByLabel('Link');
  await expect(link).toHaveValue(/\/s\/[\w-]{12}$/);
  const url = await link.inputValue();
  await dialog.getByRole('button', { name: 'Done' }).click();
  return new URL(url).pathname;
};

const downloadedSheet = async (page: Page) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: 'List actions' })
      .click()
      .then(() => page.getByRole('menuitem', { name: 'Download PDF' }).click()),
  ]);
  return download.suggestedFilename();
};

const expectPdf = async (page: Page, url: string) => {
  const response = await page.request.get(url);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
};

const summary = 'Fantasy Triumph · 8 / 36 points · 2 stands';

test('a Fantasy Triumph list is built from the home page, kept in My Armies, viewed, shared and printed', async ({
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

  await page.getByRole('link', { name: 'View Goblin raid' }).click();

  await expect(page).toHaveURL(/\/my-armies\/[\w-]+$/);
  await expect(
    page.getByRole('heading', { name: 'Goblin raid', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(section(page, 'Units').getByText('Warg riders')).toBeVisible();

  expect(await downloadedSheet(page)).toBe('Goblin raid.pdf');
  const path = await shareLink(page);

  await page.context().clearCookies();
  await page.goto(path);

  await expect(page).toHaveTitle('Goblin raid · Triumph! Army Builder');
  await expect(page.getByText('Shared copy', { exact: true })).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(
    section(page, 'Units').getByText('Javelin Cavalry', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'build your own Fantasy Triumph list' }),
  ).toHaveAttribute('href', '/fantasy/build');

  const preview = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute('content');
  const image = await page.request.get(preview ?? '');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');

  const sheet = await page
    .getByRole('link', { name: 'Open it as a PDF' })
    .getAttribute('href');
  const sheetUrl = new URL(sheet ?? '', page.url());
  await expectPdf(page, sheetUrl.toString());
  sheetUrl.searchParams.set('lang', 'es');
  await expectPdf(page, sheetUrl.toString());
});
