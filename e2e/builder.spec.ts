import { readFile } from 'node:fs/promises';
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { armyId, section } from './helpers';

const openBuilder = async (
  page: Page,
  request: APIRequestContext,
  name: string,
  search = '',
) => {
  await page.goto(`/armies/${await armyId(request, name)}/build${search}`);
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });
};

const yearSlider = (page: Page) => page.getByRole('slider', { name: 'Year' });

const troopOption = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description }).first();

const contingent = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ hasText: name }).first();

const cardGroup = (page: Page, title: string) =>
  section(page, 'Battle cards')
    .getByRole('listitem')
    .filter({ hasText: title })
    .first();

const general = (page: Page) => section(page, 'General');

const validation = (page: Page) => section(page, 'Validation');

const add = (scope: ReturnType<typeof troopOption>, label: string) =>
  scope.getByRole('button', { name: label }).click();

test('an army list leads to its builder, and back', async ({
  page,
  request,
}) => {
  await page.goto(`/armies/${await armyId(request, 'Iron Crown Knights')}`);
  await page.getByRole('button', { name: 'New list' }).click();

  await expect(page).toHaveTitle(
    'Build Iron Crown Knights · Triumph! Army Builder',
  );
  await expect(page.getByRole('textbox', { name: 'List name' })).toHaveValue(
    /^Iron Crown Knights · \d{1,2} \w+ \d{4}$/,
  );
  await expect(
    page.getByText('Iron Crown Knights · 1100–1300 AD', { exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Iron Crown Knights' }).first().click();

  await expect(
    page.getByRole('heading', { name: 'Iron Crown Knights', level: 1 }),
  ).toBeVisible();
});

test('the url carries the year and the sub-faction', async ({
  page,
  request,
}) => {
  await openBuilder(
    page,
    request,
    'Ember Principalities',
    '?year=1400&variant=cinder',
  );

  await expect(yearSlider(page)).toHaveAttribute('aria-valuetext', '1400 AD');
  await expect(
    page.getByRole('button', { name: 'Cinder', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await yearSlider(page).press('ArrowRight');

  await expect(page).toHaveURL(/year=1401/);
  await expect(yearSlider(page)).toHaveAttribute('aria-valuetext', '1401 AD');
});

test('a sample army list fills every section of the builder', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Ember Principalities', '?variant=ashen');

  const horseArchers = troopOption(page, 'Ashen horse archers');
  await expect(horseArchers).toContainText('0 of 2–6 stands');
  await add(horseArchers, 'One more Horse Bow stand');

  await add(troopOption(page, 'Ember lords'), 'One more Elite Cavalry stand');
  const sword = cardGroup(page, 'Sword-Fighting Cavalry');
  await expect(sword).toContainText('Every stand it is on costs 3½');
  await add(sword, 'One more Sword-Fighting Cavalry purchase');
  await expect(sword).toContainText('Every stand it is on costs 3½ · -½');

  await add(cardGroup(page, 'Fortified Camp'), 'One more Fortified Camp copy');

  await page
    .getByRole('radio', { name: 'Mammoth clan allies', exact: true })
    .click();
  const chieftains = contingent(page, 'Clan chieftains');
  await expect(chieftains).toContainText('Allied stands');
  await add(chieftains, 'One more Elite Cavalry stand');

  await general(page)
    .getByRole('button', {
      name: 'Elite Cavalry from Ember lords and their sworn riders',
    })
    .click();

  await expect(general(page)).toContainText(
    '1 of 3 stands can lead the army · the general is Elite Cavalry from Ember lords and their sworn riders',
  );
  await expect(
    general(page).getByRole('button', { name: /in Mammoth Clans/ }),
  ).toBeHidden();
  await expect(
    page.getByText('Stands 12 · Battle cards ½ · 4 allied'),
  ).toBeVisible();
  await expect(validation(page)).toContainText(
    'Pikes needs at least 4 stands, 0 stands selected',
  );

  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: /Copy as text/ }).click();
  const listText = page.getByRole('textbox', { name: 'List text' });
  await expect(listText).toHaveValue(
    /^Ember Principalities · \d{1,2} \w+ \d{4}\n/,
  );
  await expect(listText).toHaveValue(
    /General: Elite Cavalry \(Ember lords and their sworn riders\)/,
  );
  await expect(listText).toHaveValue(/\(ALLIED CONTINGENT\) — /);
  await page.getByRole('tab', { name: 'Markdown' }).click();
  await expect(listText).toHaveValue(
    /^# Ember Principalities · \d{1,2} \w+ \d{4}\n/,
  );
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'List actions' }).click();
  const [previewed] = await Promise.all([
    page
      .context()
      .waitForEvent('request', (sent) => sent.url().includes('/sheet?')),
    page.getByRole('menuitem', { name: 'Preview PDF' }).click(),
  ]);
  expect(previewed.url()).toMatch(/disposition=inline/);

  await page.getByRole('button', { name: 'List actions' }).click();
  const [sheet] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Download PDF' }).click(),
  ]);

  expect(sheet.suggestedFilename()).toMatch(
    /^Ember Principalities · \d{1,2} \w+ \d{4}\.pdf$/,
  );
  const downloaded = await readFile(await sheet.path());
  expect(downloaded.subarray(0, 5).toString('ascii')).toBe('%PDF-');
});

test('an optional contingent joins the army, where an ally stays apart', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Iron Crown Knights');

  await page
    .getByRole('switch', { name: 'Crown militia', exact: true })
    .click();
  await add(contingent(page, 'Town militia'), 'One more Spear stand');
  await page.getByRole('radio', { name: 'Sylvan allies', exact: true }).click();
  await add(contingent(page, 'Court champions'), 'One more Elite Foot stand');
  await add(
    troopOption(page, 'Knights of the Iron Crown'),
    'One more Knights stand',
  );

  await expect(
    page.getByText('Stands 12 · Battle cards 0 · 4 allied'),
  ).toBeVisible();
  await expect(general(page)).toContainText('1 of 3 stands can lead the army');
  await expect(
    general(page).getByRole('button', { name: /in Sylvan Courts/ }),
  ).toBeHidden();
});

test('a finding and the meter verdict scroll to what they point at', async ({
  page,
  request,
}) => {
  await openBuilder(page, request, 'Iron Crown Knights');

  await validation(page)
    .getByRole('link', { name: /Archers or Bow Levy needs at least 2 stands/ })
    .click();

  await expect(page).toHaveURL(/#troops-/);
  await expect(troopOption(page, 'Yeoman bowmen')).toBeInViewport();

  await page.getByRole('button', { name: /show validation$/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Validation' })
    .click();

  await expect(page).toHaveURL(/#validation$/);
  await expect(validation(page)).toBeInViewport();
});

test('the builder of an army the data bundle does not hold is a 404', async ({
  page,
}) => {
  const response = await page.goto('/armies/not-an-army/build');

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found', level: 1 }),
  ).toBeVisible();
});
