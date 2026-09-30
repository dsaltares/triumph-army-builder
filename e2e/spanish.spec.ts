import { expect, type Page, test } from '@playwright/test';
import { armyId, section } from './helpers';

// One journey, not a translated copy of the suite. What is worth proving is
// that the setting takes, that it reaches both the chrome and the game data,
// and that the URL never moves — the rest is the same code either way.

const pickSpanish = async (page: Page) => {
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: 'Español' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
};

test('the language picker says which language is on', async ({ page }) => {
  await page.goto('/armies');
  await page.getByRole('button', { name: 'Change language' }).click();

  await expect(page.getByRole('menuitem', { name: 'English' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(
    page.getByRole('menuitem', { name: 'Español' }),
  ).not.toHaveAttribute('aria-current', 'true');
});

test('a player picks Spanish and the whole page follows, at the same URL', async ({
  page,
}) => {
  await page.goto('/armies');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', { name: 'Armies', level: 1 }),
  ).toBeVisible();

  await pickSpanish(page);

  expect(new URL(page.url()).pathname).toBe('/armies');
  await expect(
    page.getByRole('heading', { name: 'Ejércitos', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Referencia' })).toBeVisible();
});

test('the setting outlives the page it was made on', async ({ page }) => {
  await page.goto('/armies');
  await pickSpanish(page);

  await page.goto('/reference/troop-types');

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(
    page.getByRole('heading', { name: 'Tipos de tropa', level: 1 }),
  ).toBeVisible();
});

test('the game data is Spanish too, not only the chrome', async ({
  page,
  request,
}) => {
  await page.goto('/armies');
  await pickSpanish(page);

  await page.goto(`/armies/${await armyId(request, 'Sunspire Dominion')}`);

  await expect(
    page.getByRole('heading', {
      name: 'Dominio de la Aguja del Sol',
      level: 1,
    }),
  ).toBeVisible();
  await expect(section(page, 'Tropas obligatorias')).toBeVisible();
});

test('the builder validates in Spanish', async ({ page, request }) => {
  await page.goto('/armies');
  await pickSpanish(page);

  await page.goto(
    `/armies/${await armyId(request, 'Sunspire Dominion')}/build`,
  );
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });

  await expect(section(page, 'Validación')).toBeVisible();
  await expect(
    section(page, 'Validación').getByText('Ilegal').first(),
  ).toBeVisible();
  // The findings themselves, not only the verdict around them.
  await expect(
    section(page, 'Validación').getByText(/sin gastar/),
  ).toBeVisible();
  await expect(
    section(page, 'Validación').getByText(
      'Una peana del ejército tiene que ser el general',
    ),
  ).toBeVisible();
});

test('English comes back, and nothing is left half-translated', async ({
  page,
}) => {
  await page.goto('/armies');
  await pickSpanish(page);

  await page.getByRole('button', { name: 'Cambiar de idioma' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', { name: 'Armies', level: 1 }),
  ).toBeVisible();
});
