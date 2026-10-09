import { installRecordKey } from '../lib/install.ts';
import { armyId, categoryId } from './helpers';
import { type APIRequestContext, expect, type Page, test } from './test';

const fitsTheViewport = async (page: Page) =>
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);

const openBuilder = async (
  page: Page,
  request: APIRequestContext,
  name: string,
  search = '',
) => {
  await page.goto(`/armies/${await armyId(request, name)}/build${search}`);
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });
};

const troopOption = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description }).first();

const contingent = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ hasText: name }).first();

test('every route fits the viewport', async ({ page, request }) => {
  const paths = [
    '/',
    '/armies',
    '/categories',
    '/reference',
    '/reference/troop-types',
    '/reference/battle-cards',
    '/fantasy/troop-types',
    '/fantasy/battle-cards',
    '/my-armies',
    '/collection',
    '/sign-in',
    '/sign-up',
    '/privacy',
    `/armies/${await armyId(request, 'Sylvan Courts')}`,
    `/categories/${await categoryId(request, 'The Frozen and the Dead')}`,
  ];

  for (const path of paths) {
    await page.goto(path);

    await fitsTheViewport(page);
  }
});

test('the army index scrolls to its last army without sideways scroll', async ({
  page,
}) => {
  await page.goto('/armies');
  await expect(page.getByText('8 army lists', { exact: true })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await expect(
    page.getByRole('heading', { name: 'Mammoth Clans', level: 2 }),
  ).toBeVisible();
  await fitsTheViewport(page);
});

test('a builder asking a sub-faction question fits the viewport', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Sylvan Courts');

  await fitsTheViewport(page);
});

test('the year slider is draggable under a thumb, and reaches the last year', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Sunspire Dominion', '?year=-2100');

  const slider = page.getByRole('slider', { name: 'Year' });
  const thumb = await slider.locator('..').boundingBox();
  const viewport = page.viewportSize();
  if (!thumb || !viewport) {
    throw new Error('the year slider is not on the page');
  }

  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width, thumb.y + thumb.height / 2, {
    steps: 10,
  });
  await page.mouse.up();

  await expect(slider).toHaveAttribute('aria-valuetext', '2000 BC');
  await expect(page).toHaveURL(/year=-2000/);
  await fitsTheViewport(page);
});

test('the year timeline opens on a phone, and a tap on a lane moves the year', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Tidewrack Corsairs', '?year=1300');

  await page.getByRole('button', { name: /^Timeline · / }).tap();
  await fitsTheViewport(page);

  await page.getByRole('button', { name: /^Goblin allies/ }).tap();

  await expect(page.getByRole('slider', { name: 'Year' })).toHaveAttribute(
    'aria-valuetext',
    '900 AD',
  );
  await expect(page).toHaveURL(/year=900/);
  await page.getByRole('button', { name: /^Next change, in / }).tap();
  await expect(page).not.toHaveURL(/year=900/);
});

test('a builder filling up fits the viewport at every step', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Iron Crown Knights');

  await page
    .getByRole('switch', { name: 'Crown militia', exact: true })
    .click();
  await contingent(page, 'Town militia')
    .getByRole('button', { name: 'One more Spear stand' })
    .click();

  await fitsTheViewport(page);

  await page.getByRole('radio', { name: 'Sylvan allies', exact: true }).click();
  await contingent(page, 'Court champions')
    .getByRole('button', { name: 'One more Elite Foot stand' })
    .click();

  await fitsTheViewport(page);

  await troopOption(page, 'Knights of the Iron Crown')
    .getByRole('button', { name: 'One more Knights stand' })
    .click();
  await troopOption(page, 'Knights of the Iron Crown')
    .getByRole('button', { name: 'Knights as general' })
    .click();

  await fitsTheViewport(page);

  await page.getByRole('button', { name: / — show general$/ }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'the general is Knights from Knights of the Iron Crown',
  );

  await fitsTheViewport(page);

  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: /Copy as text/ }).click();
  await expect(page.getByRole('textbox', { name: 'List text' })).toBeVisible();

  await fitsTheViewport(page);
});

test("my armies and a list's view fit the viewport with lists in them", async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Sunspire Dominion', '?year=-2100');
  await page.getByRole('textbox', { name: 'List name' }).fill('Sunrise');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Not now' })
    .click();
  await expect(page.getByRole('status', { name: 'Save status' })).toContainText(
    'Saved',
  );

  await page.goto('/my-armies');

  await expect(
    page.getByRole('row').filter({ hasText: 'Sunrise' }),
  ).toContainText('Sunspire Dominion');
  await fitsTheViewport(page);

  await page.getByRole('link', { name: 'View Sunrise', exact: true }).click();

  await expect(
    page.getByRole('heading', { name: 'Sunrise', level: 1 }),
  ).toBeVisible();
  await fitsTheViewport(page);
});

test('the new list picker fits a phone, search field and matches and all', async ({
  page,
}) => {
  await page.goto('/my-armies');
  await page.getByRole('button', { name: 'Start your first list' }).click();

  const picker = page.getByRole('dialog');
  await picker
    .getByRole('searchbox', { name: 'Search army lists' })
    .fill('Sunspire');
  await expect(
    picker.getByRole('button', { name: /Sunspire/ }).first(),
  ).toBeVisible();

  await fitsTheViewport(page);
  expect(
    await picker.evaluate((element) => {
      const { top, bottom } = element.getBoundingClientRect();
      return top >= 0 && bottom <= window.innerHeight;
    }),
  ).toBe(true);
});

test('a shared list fits the viewport, stands and battle cards and all', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Iron Crown Knights');
  await page
    .getByRole('switch', { name: 'Crown militia', exact: true })
    .click();
  await contingent(page, 'Town militia')
    .getByRole('button', { name: 'One more Spear stand' })
    .click();

  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: 'Share link' }).click();
  const link = page.getByRole('dialog').getByLabel('Link');
  await expect(link).toHaveValue(/\/s\//);

  await page.goto(new URL(await link.inputValue()).pathname);

  await expect(
    page.getByRole('heading', { name: 'Iron Crown Knights', level: 1 }),
  ).toBeVisible();
  await fitsTheViewport(page);

  const table = page.getByRole('table', { name: 'Crown militia' });
  const troopType = table.getByRole('rowheader').first();
  const shotAt = table.getByRole('columnheader', { name: 'Shot at' });
  const left = async (cell: typeof troopType) =>
    (await cell.boundingBox())?.x ?? Number.NaN;
  const troopTypeBefore = await left(troopType);
  const shotAtBefore = await left(shotAt);

  await table.evaluate((element) => {
    const scroller = element.parentElement;
    if (scroller) {
      scroller.scrollLeft = scroller.scrollWidth;
    }
  });

  await expect.poll(() => left(shotAt)).toBeLessThan(shotAtBefore);
  expect(await left(troopType)).toBe(troopTypeBefore);
  await fitsTheViewport(page);
});

const comeBackLater = async (page: Page, path: string) => {
  await page.waitForFunction(
    (key) => localStorage.getItem(key) !== null,
    installRecordKey,
  );
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(path);
};

test('a phone coming back is told how to install the app, once', async ({
  page,
}) => {
  await page.goto('/armies');

  await expect(page.getByRole('dialog')).toBeHidden();

  await comeBackLater(page, '/armies');

  const prompt = page.getByRole('dialog');
  await expect(
    prompt.getByText('Add the builder to your home screen'),
  ).toBeVisible();
  await expect(
    prompt.getByText(/Open the browser menu, then Install app/),
  ).toBeVisible();
  await fitsTheViewport(page);

  await prompt.getByRole('button', { name: 'Not now' }).click();

  await expect(prompt).toBeHidden();

  await comeBackLater(page, '/reference');

  await expect(page.getByRole('dialog')).toBeHidden();
});
