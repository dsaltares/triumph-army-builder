import { categoryId } from './helpers';
import { type APIRequestContext, expect, type Page, test } from './test';

const _openCategory = async (
  page: Page,
  request: APIRequestContext,
  name: string,
) => page.goto(`/categories/${await categoryId(request, name)}`);

test('the category index holds every thematic category', async ({ page }) => {
  await page.goto('/categories');

  await expect(
    page.getByRole('heading', { name: 'Categories', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(4);
  await expect(
    page.getByRole('link', { name: 'The Frozen and the Dead' }),
  ).toContainText('3 army lists');
});

test('a category scopes the army index, and walks into a list and back', async ({
  page,
}) => {
  await page.goto('/categories');
  await page.getByRole('link', { name: 'The Frozen and the Dead' }).click();

  await expect(page).toHaveTitle(
    'The Frozen and the Dead · Triumph! Army Builder',
  );
  await expect(
    page.getByRole('heading', { name: 'The Frozen and the Dead', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('3 army lists', { exact: true })).toBeVisible();

  await page
    .getByRole('searchbox', { name: 'Search army lists' })
    .fill('mammoth');

  await expect(page.getByText('1 of 3 army lists')).toBeVisible();

  await page.getByRole('link', { name: /^Mammoth Clans/ }).click();

  await expect(
    page.getByRole('heading', { name: 'Mammoth Clans', level: 1 }),
  ).toBeVisible();

  await page.goBack();
  await page.getByRole('link', { name: 'All categories' }).click();

  await expect(page).toHaveURL('/categories');
});

test('a category the data bundle does not hold is a 404', async ({ page }) => {
  const response = await page.goto('/categories/not-a-category');

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found', level: 1 }),
  ).toBeVisible();
});
