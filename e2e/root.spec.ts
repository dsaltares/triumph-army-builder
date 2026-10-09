import { expect, test } from './test';

test('the root opens My Armies, and the wordmark comes back to it', async ({
  page,
}) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL('/my-armies');
  await expect(page).toHaveTitle('My Armies · Triumph! Army Builder');
  await expect(
    page.getByRole('heading', { name: 'My Armies', level: 1 }),
  ).toBeVisible();

  await page.goto('/reference');
  await page.getByRole('link', { name: 'Triumph! Army Builder' }).click();

  await expect(page).toHaveURL('/my-armies');
});

test('a new player at the root learns what the app is and has two ways in', async ({
  page,
}) => {
  await page.goto('/');

  const main = page.getByRole('main');

  await expect(main.getByText('No lists saved yet')).toBeVisible();
  await expect(
    main.getByText(/Build, validate and share army lists for the Triumph!/),
  ).toBeVisible();
  await expect(main.getByText(/48 points of troop stands/)).toBeVisible();

  await main.getByRole('link', { name: 'Categories', exact: true }).click();

  await expect(page).toHaveURL('/categories');

  await page.goto('/');
  await page.getByRole('link', { name: 'Browse armies' }).click();

  await expect(page).toHaveURL('/armies');
});

test('the tab and the home screen have the mark', async ({ page, request }) => {
  await page.goto('/armies');

  const icon = page.locator('link[rel="icon"]').first();
  await expect(icon).toHaveAttribute('href', /favicon/);

  for (const path of [
    '/apple-icon.png',
    '/brand/mark.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('image/');
  }
});

test('the manifest installs the app in the colours it launches in', async ({
  page,
  request,
}) => {
  await page.goto('/armies');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );

  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  expect(manifest.name).toBe('Triumph! Army Builder');
  expect(manifest.short_name).toBe('Triumph!');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/my-armies');
  expect(manifest.scope).toBe('/');
  expect(manifest.theme_color).toBe('#0c0a09');
  expect(manifest.background_color).toBe('#0c0a09');
  expect(manifest.icons).toEqual([
    {
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ]);
});

test('every page carries the security headers', async ({ request }) => {
  const response = await request.get('/armies');

  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  expect(response.headers()['referrer-policy']).toBe(
    'strict-origin-when-cross-origin',
  );
  expect(response.headers()['permissions-policy']).toContain('camera=()');
  expect(response.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  );
  expect(response.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
});

test('the manifest carries them too, not just the pages', async ({
  request,
}) => {
  const response = await request.get('/manifest.webmanifest');

  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  );
});
