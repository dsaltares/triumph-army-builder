import { photoBytes } from '../test/photos.ts';
import { armyId, freshEmail, signUpAndIn } from './helpers';
import { expect, type Page, test } from './test';

const saveStatus = (page: Page) =>
  page.getByRole('status', { name: 'Save status' });

test('an entry with a photo shrunk in the browser shows on the collection and covers a saved list', async ({
  page,
  request,
}) => {
  await signUpAndIn(page, freshEmail());
  await page.goto('/collection');
  await page.getByRole('button', { name: 'Add stands' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Sun chariots');
  await dialog.getByRole('button', { name: 'One stand more' }).click();
  await dialog.getByRole('combobox', { name: 'Fields as' }).fill('CHT');
  await page.getByRole('option', { name: /^CHT · / }).click();
  await dialog.getByRole('combobox', { name: 'Tags' }).fill('chariots');
  await dialog.getByRole('combobox', { name: 'Tags' }).press(',');
  await dialog.getByRole('combobox', { name: 'Tags' }).press('Tab');
  await dialog.getByRole('radio', { name: 'Painted', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add to collection' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Edit Sun chariots' }).click();
  await expect(dialog.getByRole('button', { name: 'Add photo' })).toBeEnabled();
  const original = Buffer.from(
    await photoBytes({ width: 3200, height: 2400, grain: true }),
  );
  const upload = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().endsWith('/api/collection/photos'),
  );
  await dialog.getByLabel('Photo files').setInputFiles({
    name: 'phone.jpg',
    mimeType: 'image/jpeg',
    buffer: original,
  });

  await expect(
    dialog.getByRole('img', { name: 'Sun chariots · photo 1 of 1' }),
  ).toBeVisible();
  const { requestBodySize } = await (await upload).sizes();
  expect(requestBodySize).toBeLessThan(original.byteLength / 4);

  await dialog.getByRole('button', { name: 'View photo 1 of 1' }).click();
  const large = page
    .getByRole('img', { name: 'Sun chariots · photo 1 of 1' })
    .last();
  await expect
    .poll(() => large.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1600);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  const cover = page.getByRole('img', { name: 'Photo of Sun chariots' });
  await expect(cover).toBeVisible();
  await expect
    .poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(400);

  await page.goto(`/armies/${await armyId(request, 'Sunspire Dominion')}`);
  await page.getByRole('button', { name: 'New list' }).click();
  await expect(page).toHaveURL(/\?list=/);
  await page.goto(`${page.url()}&year=-2100`);
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });
  const chariots = page
    .getByRole('listitem')
    .filter({ hasText: '2-horse chariots of the sun' })
    .first();
  await chariots
    .getByRole('button', { name: 'One more Chariots stand' })
    .click();
  await chariots
    .getByRole('button', { name: 'One more Chariots stand' })
    .click();
  await page.getByRole('textbox', { name: 'List name' }).fill('Sunrise');
  await expect(saveStatus(page)).toContainText('Saved');

  await page.getByRole('link', { name: 'My Armies' }).first().click();
  await page.getByRole('link', { name: 'View Sunrise', exact: true }).click();

  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: 'Can I build it?' }).click();
  const coverage = page.getByRole('dialog', { name: 'Can I build it?' });
  await expect(coverage).toContainText(
    '8 of 8 points covered · ready to field',
  );
  await expect(
    coverage.getByText(
      'Your collection covers every stand, all of them painted',
    ),
  ).toBeVisible();
  await expect(coverage.getByText('Sun chariots × 2')).toBeVisible();
  await expect(coverage.getByText('✓ Match')).toBeVisible();
});

test('an army the collection builds opens as a view, and is saved only when edited', async ({
  page,
}) => {
  await signUpAndIn(page, freshEmail());
  await page.goto('/collection');
  await page.getByRole('button', { name: 'Add stands' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Gilded companions');
  await dialog.getByRole('combobox', { name: 'Fields as' }).fill('ECV');
  await page.getByRole('option', { name: /^ECV · / }).click();
  await dialog.getByRole('button', { name: 'Add to collection' }).click();
  await expect(dialog).toBeHidden();

  await page
    .getByRole('searchbox', { name: 'Search armies you can build' })
    .fill('Sunspire Dominion');
  await page
    .getByRole('link', { name: /^Sunspire Dominion/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/collection\/preview\?s=/);
  await expect(page.getByText(/^Not saved yet/)).toBeVisible();
  await page.getByRole('link', { name: 'My Armies' }).first().click();
  await expect(page.getByText('No lists saved yet')).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/build\?list=/);
  await page.getByRole('link', { name: 'My Armies' }).first().click();
  await expect(
    page.getByRole('link', { name: /^View Sunspire Dominion/ }),
  ).toHaveCount(1);
});
