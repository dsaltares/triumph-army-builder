import { test as base } from '@playwright/test';
import { hydratedAttribute } from '../components/layout/hydration-marker.tsx';

export * from '@playwright/test';

const hydrated = `html[${hydratedAttribute}]`;

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      if (response?.ok()) {
        await page
          .locator(hydrated)
          .waitFor({ state: 'attached', timeout: 15_000 });
      }
      return response;
    };
    await use(page);
  },
});
