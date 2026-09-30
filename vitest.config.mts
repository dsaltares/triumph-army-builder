import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = {
  'next/font/google': fileURLToPath(
    new URL('./test/mocks/next-font-google.ts', import.meta.url),
  ),
  '@': fileURLToPath(new URL('.', import.meta.url)),
};

const realDataTests = '**/*.real-data.test.ts';

const sampleAlias = [
  {
    find: /^(\.\.\/)+data\/snapshot\/manifest\.json$/,
    replacement: fileURLToPath(
      new URL(
        './test/fixtures/reference/snapshot/manifest.json',
        import.meta.url,
      ),
    ),
  },
  ...Object.entries(alias).map(([find, replacement]) => ({
    find,
    replacement,
  })),
];

const shared = {
  exclude: ['**/node_modules/**', '.next/**', 'e2e/**'],
  clearMocks: true,
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias: sampleAlias },
        test: {
          ...shared,
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: [...shared.exclude, realDataTests],
        },
      },
      {
        resolve: { alias },
        test: {
          ...shared,
          name: 'real-data',
          environment: 'node',
          include: [realDataTests],
        },
      },
      {
        resolve: { alias: sampleAlias },
        test: {
          ...shared,
          name: 'ui',
          environment: 'happy-dom',
          include: ['**/*.test.tsx'],
          setupFiles: ['./test/dom-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/domain/**/*.{ts,tsx}'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
