import { expect, type Page, test } from './test';

const destinations = [
  { label: 'Armies', path: '/armies', heading: 'Armies' },
  { label: 'Categories', path: '/categories', heading: 'Categories' },
  { label: 'Reference', path: '/reference', heading: 'Reference' },
  { label: 'My Armies', path: '/my-armies', heading: 'My Armies' },
  { label: 'Collection', path: '/collection', heading: 'Collection' },
];

const legalPages = [
  {
    label: 'Privacy policy',
    path: '/privacy',
    heading: 'Privacy policy',
    mentions: ['The activity log', 'IP Geolocation by DB-IP'],
  },
  {
    label: 'Terms and conditions',
    path: '/terms',
    heading: 'Terms and conditions',
    mentions: [],
  },
  {
    label: 'Cookie policy',
    path: '/cookies',
    heading: 'Cookie policy',
    mentions: ['adds no cookie'],
  },
];

const openNav = async (page: Page) => {
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.count()) {
    await menu.click();
  }
};

test('the primary nav walks every top-level route, marking the one you are on', async ({
  page,
}) => {
  await page.goto('/');

  for (const { label, path, heading } of destinations) {
    await openNav(page);
    await page.getByRole('link', { name: label, exact: true }).click();

    await expect(page).toHaveURL(path);
    await expect(
      page.getByRole('heading', { name: heading, level: 1 }),
    ).toBeVisible();

    await openNav(page);
    await expect(
      page.getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  }

  await page.getByRole('link', { name: 'Triumph! Army Builder' }).click();

  await expect(page).toHaveURL('/my-armies');
});

test('every route carries the same chrome', async ({ page }) => {
  for (const { path } of [{ path: '/' }, ...destinations]) {
    await page.goto(path);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Change theme' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('contentinfo')
        .getByText(
          /Army list data from Meshwesh, version \d{4}-\d{2}-\d{2}\.[0-9a-f]{8}/,
        ),
    ).toBeVisible();
  }
});

test('an unknown route is a 404 inside the chrome', async ({ page }) => {
  const response = await page.goto('/not-a-route');

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
});

test('the footer reaches every legal page, and each stands alone', async ({
  page,
  request,
}) => {
  for (const { label, path, heading, mentions } of legalPages) {
    const served = await request.get(path);

    expect(served.status(), path).toBe(200);
    const html = await served.text();
    for (const text of [heading, ...mentions]) {
      expect(html, path).toContain(text);
    }

    await page.goto('/');
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: label })
      .click();

    await expect(page).toHaveURL(path);
    await expect(
      page.getByRole('heading', { name: heading, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Privacy policy' }).first(),
    ).toBeVisible();
  }
});
