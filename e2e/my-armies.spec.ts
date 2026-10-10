import { armyId } from './helpers';
import { expect, type Page, test } from './test';

const savedRow = (page: Page, name: string) =>
  page.getByRole('row').filter({ hasText: name }).first();

const columnHeader = (page: Page, name: string) =>
  page.getByRole('columnheader', { name });

const menuFor = (page: Page, name: string) =>
  page.getByRole('button', { name: `Actions for ${name}` });

const dialog = (page: Page) => page.getByRole('dialog');

const saveStatus = (page: Page) =>
  page.getByRole('status', { name: 'Save status' });

test('a list saved from the builder is managed from My Armies, viewed, and opens again where it left off', async ({
  browser,
  page,
  request,
}) => {
  await page.goto(`/armies/${await armyId(request, 'Sunspire Dominion')}`);
  await page.getByRole('button', { name: 'New list' }).click();

  await expect(page.getByText('Saved within your browser')).toBeVisible();
  await expect(page).toHaveURL(/\?list=/);
  await page.goto(`${page.url()}&year=-2100`);
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole('listitem')
    .filter({ hasText: '2-horse chariots of the sun' })
    .first()
    .getByRole('button', { name: 'One more Chariots stand' })
    .click();

  await expect(page.getByRole('textbox', { name: 'List name' })).toHaveValue(
    /^Sunspire Dominion · \d{1,2} \w+ \d{4}$/,
  );
  await page.getByRole('textbox', { name: 'List name' }).fill('Sunrise');

  await expect(saveStatus(page)).toContainText('Saving');
  await expect(saveStatus(page)).toContainText('Saved');

  await page.getByRole('link', { name: 'My Armies' }).first().click();

  await expect(page).toHaveTitle('My Armies · Triumph! Army Builder');
  await expect(page.getByText('1 list')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New list' })).toBeVisible();
  await expect(savedRow(page, 'Sunrise')).toContainText('Sunspire Dominion');
  await expect(savedRow(page, 'Sunrise')).toContainText('4 / 48');
  await expect(savedRow(page, 'Sunrise')).toContainText('Illegal');

  await expect(columnHeader(page, 'Created')).toBeVisible();
  await expect(columnHeader(page, 'Saved')).toBeVisible();

  await columnHeader(page, 'List').getByRole('button').click();

  await expect(page).toHaveURL(/sort=name&dir=asc/);
  await expect(columnHeader(page, 'List')).toHaveAttribute(
    'aria-sort',
    'ascending',
  );

  await menuFor(page, 'Sunrise').click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await dialog(page).getByLabel('List name').fill('Sunrise 2100 BC');
  await dialog(page).getByRole('button', { name: 'Rename' }).click();

  await expect(savedRow(page, 'Sunrise 2100 BC')).toBeVisible();

  await menuFor(page, 'Sunrise 2100 BC').click();
  const duplicated = page.waitForResponse((response) =>
    response.url().includes('army.duplicate'),
  );
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();

  await expect(savedRow(page, 'Sunrise 2100 BC (copy)')).toBeVisible();

  await duplicated;
  await page.reload();

  await expect(savedRow(page, 'Sunrise 2100 BC (copy)')).toBeVisible();
  await menuFor(page, 'Sunrise 2100 BC (copy)').click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await dialog(page).getByRole('button', { name: 'Delete list' }).click();

  await expect(savedRow(page, 'Sunrise 2100 BC (copy)')).toBeHidden();

  await page
    .getByRole('link', { name: 'View Sunrise 2100 BC', exact: true })
    .click();

  await expect(page).toHaveURL(/\/my-armies\/[\w-]+$/);
  await expect(page).toHaveTitle('Sunrise 2100 BC · Triumph! Army Builder');
  await expect(
    page.getByRole('heading', { name: 'Sunrise 2100 BC', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/1 × Chariots/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save a copy' })).toBeHidden();
  const view = new URL(page.url()).pathname;

  const stranger = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  expect((await stranger.request.get(view)).status()).toBe(404);
  await stranger.close();

  await page.getByRole('link', { name: 'Edit', exact: true }).click();

  await expect(page).toHaveURL(/list=/);
  await expect(page.getByRole('slider', { name: 'Year' })).toHaveAttribute(
    'aria-valuetext',
    '2100 BC',
  );
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: '2-horse chariots of the sun' })
      .first(),
  ).toContainText('1 of 2–4 stands');
  await expect(saveStatus(page)).toContainText('Saved');

  await page
    .getByRole('listitem')
    .filter({ hasText: '2-horse chariots of the sun' })
    .first()
    .getByRole('button', { name: 'One more Chariots stand' })
    .click();
  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: 'View list' }).click();

  await expect(page).toHaveURL(view);
  await expect(page.getByText(/2 × Chariots/)).toBeVisible();
});

test('My Armies offers an anonymous player the way to keep their lists', async ({
  page,
}) => {
  await page.goto('/my-armies');

  await expect(page.getByText('No lists saved yet')).toBeVisible();
  await expect(
    page.getByText(/you will lose them if you delete browsing data/i),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Browse armies' }).click();

  await expect(page).toHaveURL('/armies');
});

test('a new list starts from the My Armies empty state, by searching for an army', async ({
  page,
}) => {
  await page.goto('/my-armies');

  await expect(page.getByRole('button', { name: 'New list' })).toBeHidden();
  await page.getByRole('button', { name: 'Start your first list' }).click();
  await dialog(page)
    .getByRole('button', { name: /^Triumph!/ })
    .click();

  const search = dialog(page).getByRole('searchbox', {
    name: 'Search army lists',
  });
  await search.fill('Sunspire Dominion');
  await expect(dialog(page).getByText(/^1 of \d+ army lists$/)).toBeVisible();
  await expect(
    dialog(page).getByRole('button', { name: /^Sunspire Dominion/ }),
  ).toBeVisible();

  await search.press('Enter');

  await expect(page).toHaveTitle(
    'Build Sunspire Dominion · Triumph! Army Builder',
  );
  await expect(page).toHaveURL(/\/triumph\/build\?list=/);
  await expect(saveStatus(page)).toContainText('Saved');
});
