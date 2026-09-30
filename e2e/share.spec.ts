import { expect, type Page, test } from '@playwright/test';
import { armyId, section } from './helpers.ts';

const troopOption = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description }).first();

const cardGroup = (page: Page, title: string) =>
  section(page, 'Battle cards')
    .getByRole('listitem')
    .filter({ hasText: title })
    .first();

const shareLink = async (page: Page) => {
  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: 'Share link' }).click();
  const dialog = page.getByRole('dialog');
  const link = dialog.getByLabel('Link');
  await expect(link).toHaveValue(/\/s\/[\w-]{12}$/);
  const url = await link.inputValue();

  await expect(
    dialog.getByRole('img', { name: `QR code for ${url}` }),
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Done' }).click();
  return new URL(url).pathname;
};

const downloadedSheet = async (page: Page) => {
  const [request, download] = await Promise.all([
    page.waitForRequest((sent) => sent.url().includes('/sheet?')),
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: 'List actions' })
      .click()
      .then(() => page.getByRole('menuitem', { name: 'Download PDF' }).click()),
  ]);
  return {
    share: new URL(request.url()).searchParams.get('share'),
    filename: download.suggestedFilename(),
  };
};

const asSomeoneElse = async (page: Page, path: string) => {
  await page.context().clearCookies();
  await page.goto(path);
};

const metaContent = (page: Page, property: string) =>
  page.locator(`meta[property="${property}"]`).first();

const sharedName = /^Iron Crown Knights · \d{1,2} \w+ \d{4}$/;

test('a list shared from the builder opens as a copy for whoever has the link', async ({
  page,
  request,
}) => {
  await page.goto(
    `/armies/${await armyId(request, 'Iron Crown Knights')}/build`,
  );
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });

  await troopOption(page, 'Yeoman bowmen')
    .getByRole('button', { name: 'One more Bow Levy stand' })
    .click();
  await cardGroup(page, 'Fortified Camp')
    .getByRole('button', { name: 'One more Fortified Camp copy' })
    .click();

  const path = await shareLink(page);

  const sheet = await downloadedSheet(page);
  expect(sheet.share).toBe(path.replace('/s/', ''));
  expect(sheet.filename).toMatch(
    /^Iron Crown Knights · \d{1,2} \w+ \d{4}\.pdf$/,
  );

  await asSomeoneElse(page, path);

  await expect(page).toHaveTitle(
    /^Iron Crown Knights · \d{1,2} \w+ \d{4} · Triumph! Army Builder$/,
  );
  await expect(
    page.getByRole('heading', { name: sharedName, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('1 × Bow Levy', { exact: true })).toBeVisible();
  await expect(page.getByText('Fortified camp', { exact: true })).toBeVisible();

  await expect(metaContent(page, 'og:title')).toHaveAttribute(
    'content',
    sharedName,
  );
  const preview = await metaContent(page, 'og:image').getAttribute('content');
  expect(preview).toContain(`${path}/opengraph-image`);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    /noindex/,
  );

  const image = await page.request.get(preview ?? '');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');

  await expect(page.getByText('Shared copy', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save a copy' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('List name').fill('Knights from a friend');
  await dialog.getByRole('button', { name: 'Save copy' }).click();

  await expect(page).toHaveURL(/\/build\?list=/);

  await page.goto('/my-armies');
  await expect(
    page.getByRole('link', { name: 'Knights from a friend', exact: true }),
  ).toBeVisible();
});

test('a link to a list nobody shared lands on the not-found page', async ({
  page,
}) => {
  await page.goto('/s/nothinghere1');

  await expect(
    page.getByRole('heading', { name: 'Page not found', level: 1 }),
  ).toBeVisible();
});
