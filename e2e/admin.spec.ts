import { expect, type Page, test } from '@playwright/test';
import { devUser } from '../lib/db/dev-user.ts';
import { freshEmail, signInAs, signUpAndIn } from './helpers.ts';

const adminLink = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Admin', exact: true });

const viewerProcedure = 'admin.viewer';

const batchedProcedures = (url: string) =>
  new URL(url).pathname.replace('/api/trpc/', '').split(',');

const viewerAnswered = async (page: Page) => {
  const response = await page.waitForResponse((answered) =>
    batchedProcedures(answered.url()).includes(viewerProcedure),
  );
  const results = (await response.json()) as unknown[];
  return results[batchedProcedures(response.url()).indexOf(viewerProcedure)];
};

test('the dev user, an admin, reaches the dashboard from the nav', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await signInAs(page, devUser.email, devUser.password);
  await expect(page).toHaveURL('/my-armies');

  await adminLink(page).click();

  await expect(page).toHaveURL('/admin');
  await expect(page).toHaveTitle(/^Admin · /);
  await expect(
    page.getByRole('heading', { name: 'Admin', level: 1 }),
  ).toBeVisible();
  await expect(adminLink(page)).toHaveAttribute('aria-current', 'page');
});

test('anyone else sees no link, and the page is not there', async ({
  page,
}) => {
  const visit = async () => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'Page not found', level: 1 }),
    ).toBeVisible();
    await expect(page).not.toHaveTitle(/Admin/);
  };

  await visit();

  const refused = viewerAnswered(page);
  await signUpAndIn(page, freshEmail());
  expect(await refused).toMatchObject({
    result: { data: { isAdmin: false } },
  });
  await expect(adminLink(page)).toHaveCount(0);

  const refusedAgain = viewerAnswered(page);
  await visit();
  await refusedAgain;
  await expect(adminLink(page)).toHaveCount(0);
});
