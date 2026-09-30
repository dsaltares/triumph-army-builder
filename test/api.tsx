import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { Insertable, Kysely } from 'kysely';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { NextIntlClientProvider } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { createRateLimiter } from '@/lib/auth/rate-limit';
import { createDatabase } from '@/lib/db/client';
import type { PhotoQuota } from '@/lib/db/collection-photos';
import { migrateToLatest } from '@/lib/db/migrator';
import { databaseBundleSource } from '@/lib/db/reference';
import type { Database, UsersTable } from '@/lib/db/schema';
import { messagesFor } from '@/lib/i18n/messages';
import { defaultLocale, type Locale } from '@/lib/i18n/routing';
import { defaultPhotoQuota } from '@/lib/photos/limits';
import { servePhotoResponse } from '@/lib/photos/serve';
import { createPhotoStore, type PhotoStore } from '@/lib/photos/store';
import { uploadPhotoResponse } from '@/lib/photos/upload';
import { responseMeta } from '@/lib/trpc/cache';
import { TRPCClientProvider } from '@/lib/trpc/client';
import type { Caller, Context } from '@/lib/trpc/context';
import { trpcEndpoint } from '@/lib/trpc/endpoint';
import { appRouter } from '@/lib/trpc/root';
import { carthage } from '@/test/events.ts';
import { fixtureDataVersion } from '@/test/fixtures/army.ts';
import { type BundleFiles, seedDataVersion } from '@/test/reference.ts';

const origin = 'http://localhost:3013';

const firstTick = Date.UTC(2026, 8, 18, 10, 0);

const tickMs = 60_000;

const testQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const ApiProviders = ({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) => {
  const [queryClient] = useState(testQueryClient);
  return (
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
      <TRPCClientProvider
        queryClient={queryClient}
        url={`${origin}${trpcEndpoint}`}
      >
        {children}
      </TRPCClientProvider>
    </NextIntlClientProvider>
  );
};

export const serveApi = ({
  bundle,
  translated,
  dataVersion = fixtureDataVersion,
}: {
  bundle?: BundleFiles;
  translated?: Partial<Record<Locale, BundleFiles>>;
  dataVersion?: string;
} = {}) => {
  let db: Kysely<Database>;
  let caller: Caller | null = null;
  let minted = 0;
  let ticks = 0;
  let photoDirectory: string;
  let photos: PhotoStore;
  let photoQuota: PhotoQuota = defaultPhotoQuota;
  let photoIds = 0;
  let answered = 0;

  const context = (): Context => ({
    db,
    caller,
    origin: carthage,
    photos,
    photoQuota,
    bundles: (locale, version) => databaseBundleSource(db, locale, version),
    now: () => new Date(firstTick + ++ticks * tickMs).toISOString(),
    nextId: () => `army-${++minted}`,
  });

  const apiHandler = http.all(
    `${origin}${trpcEndpoint}/*`,
    async ({ request }) => {
      const response = await fetchRequestHandler({
        endpoint: trpcEndpoint,
        req: request,
        router: appRouter,
        createContext: context,
        responseMeta,
      });
      answered += 1;
      return response;
    },
  );

  const uploadHandler = http.post('*/api/collection/photos', ({ request }) =>
    uploadPhotoResponse({
      request,
      caller,
      origin: carthage,
      db,
      store: photos,
      quota: photoQuota,
      limiter: createRateLimiter({ window: 3600, max: 100 }),
      nextId: () => `photo-${++photoIds}`,
      now: () => new Date(firstTick + ++ticks * tickMs).toISOString(),
    }),
  );

  const serveHandler = http.get(
    '*/api/collection/photos/:id/:size',
    ({ params }) =>
      servePhotoResponse({
        caller,
        db,
        store: photos,
        id: String(params.id),
        size: String(params.size),
      }),
  );

  const handlers = [apiHandler, uploadHandler, serveHandler];

  const failingProcedure = (procedure: string) =>
    http.all(`${origin}${trpcEndpoint}/${procedure}`, () =>
      HttpResponse.json(
        { error: { message: 'somethingWentWrong', code: -32603 } },
        { status: 500 },
      ),
    );

  const server = setupServer(...handlers);

  beforeAll(async () => {
    photoDirectory = await mkdtemp(join(tmpdir(), 'triumph-ui-photos-'));
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterAll(async () => {
    server.close();
    await rm(photoDirectory, { recursive: true, force: true });
  });

  beforeEach(async () => {
    db = createDatabase(':memory:');
    await migrateToLatest(db);
    await seedDataVersion(db, dataVersion, bundle, translated);
    caller = null;
    minted = 0;
    ticks = 0;
    photoIds = 0;
    answered = 0;
    photoQuota = defaultPhotoQuota;
    await rm(photoDirectory, { recursive: true, force: true });
    photos = createPhotoStore(photoDirectory);
  });

  afterEach(async () => {
    server.resetHandlers(...handlers);
    await db.destroy();
  });

  const user = (id: string, isAnonymous = 0): Insertable<UsersTable> => ({
    id,
    name: id,
    email: `${id}@example.test`,
    image: null,
    isAnonymous,
  });

  const arrive = async (
    userId: string,
    isAnonymous: boolean,
    isAdmin = false,
  ) => {
    await db
      .insertInto('users')
      .values(user(userId, isAnonymous ? 1 : 0))
      .execute();
    caller = { userId, isAnonymous, isAdmin };
  };

  return {
    database: () => db,
    importVersion: (next: string) =>
      seedDataVersion(db, next, bundle, translated),
    answered: () => answered,
    photos: () => photos,
    limitPhotos: (quota: PhotoQuota) => {
      photoQuota = quota;
    },
    missing: (path: string) =>
      db.deleteFrom('reference_documents').where('path', '=', path).execute(),
    fails: (procedure: string) => server.use(failingProcedure(procedure)),
    recovers: () => server.resetHandlers(...handlers),
    signIn: (userId: string) => arrive(userId, false),
    signInAsAdmin: (userId: string) => arrive(userId, false, true),
    signInAnonymously: (userId: string) => arrive(userId, true),
    signOut: () => {
      caller = null;
    },
    wrap: (children: ReactNode, locale: Locale = defaultLocale) => (
      <ApiProviders locale={locale}>{children}</ApiProviders>
    ),
  };
};
