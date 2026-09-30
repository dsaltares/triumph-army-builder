import { gzipSync } from 'node:zlib';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bundlePaths, eagerPayloadBudgetBytes } from '@/lib/data/bundle.ts';
import type { ReferencePack } from '@/lib/data/reference-pack.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import {
  databaseBundleSource,
  makeReferenceCurrent,
} from '@/lib/db/reference.ts';
import type { Locale } from '@/lib/i18n/locales.ts';
import { defaultPhotoQuota } from '@/lib/photos/limits.ts';
import {
  currentReferenceCache,
  pinnedReferenceCache,
  responseMeta,
} from '@/lib/trpc/cache.ts';
import type { Caller, Context } from '@/lib/trpc/context.ts';
import { trpcEndpoint } from '@/lib/trpc/endpoint.ts';
import { appRouter, createCaller } from '@/lib/trpc/root.ts';
import { carthage } from '@/test/events.ts';
import { absentPhotoStore } from '@/test/photo-store.ts';
import {
  renamedArmyIndex,
  samplePack,
  seedDataVersion,
  seedReference,
} from '@/test/reference.ts';

let db: ReturnType<typeof createDatabase>;
let pack: ReferencePack;

const firstVersion = '2026-09-17.8457e4d4';
const secondVersion = '2026-09-28.0123abcd';

const hannibal: Caller = {
  userId: 'user-hannibal',
  isAnonymous: false,
  isAdmin: false,
};

const context = (caller: Caller | null = null): Context => ({
  db,
  caller,
  origin: carthage,
  photos: absentPhotoStore(),
  photoQuota: defaultPhotoQuota,
  bundles: (locale, dataVersion) =>
    databaseBundleSource(db, locale, dataVersion),
  now: () => new Date(Date.UTC(2026, 8, 29, 10, 0)).toISOString(),
  nextId: () => 'id-1',
});

const reference = (caller: Caller | null = null) =>
  createCaller(context(caller)).reference;

const packed = (locale: Locale, path: string) =>
  pack.locales[locale].find((file) => file.path === path)?.contents;

const firstArmyId = () => {
  const path = pack.locales.en.find(({ path }) =>
    path.startsWith('armies/'),
  )?.path;
  if (!path) {
    throw new Error('the sample pack has no army lists');
  }
  return path.replace(/^armies\/(.+)\.json$/, '$1');
};

const request = (calls: readonly { path: string; input?: unknown }[]) => {
  const paths = calls.map(({ path }) => path).join(',');
  const input = Object.fromEntries(
    calls.map(({ input }, index) => [index, input]),
  );
  return fetchRequestHandler({
    endpoint: trpcEndpoint,
    req: new Request(
      `http://localhost:3013${trpcEndpoint}/${paths}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
    ),
    router: appRouter,
    createContext: () => context(),
    responseMeta,
  });
};

beforeAll(async () => {
  pack = await samplePack();
});

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('reference.current', () => {
  it('answers a caller with no session', async () => {
    await seedDataVersion(db, firstVersion);

    expect(await reference().current()).toBe(firstVersion);
  });

  it('answers a signed-in caller the same', async () => {
    await seedDataVersion(db, firstVersion);

    expect(await reference(hannibal).current()).toBe(firstVersion);
  });

  it('follows an import and a rollback without a restart', async () => {
    await seedDataVersion(db, firstVersion);
    await seedDataVersion(db, secondVersion);

    expect(await reference().current()).toBe(secondVersion);

    await makeReferenceCurrent(db, firstVersion);

    expect(await reference().current()).toBe(firstVersion);
  });

  it('says how to import data when no version is current', async () => {
    await expect(reference().current()).rejects.toThrow(
      /No reference data is current. Run `yarn db:import-reference <pack>`/,
    );
  });
});

describe('the reference reads', () => {
  beforeEach(async () => {
    await seedReference(db, pack);
  });

  it('serves every document of the current version in the locale asked', async () => {
    for (const locale of ['en', 'es'] as const) {
      const input = { locale };
      const read = reference();

      expect(await read.index(input)).toEqual(
        packed(locale, bundlePaths.index),
      );
      expect(await read.troopTypes(input)).toEqual(
        packed(locale, bundlePaths.troopTypes),
      );
      expect(await read.battleCards(input)).toEqual(
        packed(locale, bundlePaths.battleCards),
      );
      expect(await read.battleCardText(input)).toEqual(
        packed(locale, bundlePaths.battleCardText),
      );
      expect(await read.thematicCategories(input)).toEqual(
        packed(locale, bundlePaths.thematicCategories),
      );
      expect(await read.tagWords(input)).toEqual(
        packed(locale, bundlePaths.tagWords),
      );
      expect(await read.army({ ...input, id: firstArmyId() })).toEqual(
        packed(locale, bundlePaths.army(firstArmyId())),
      );
    }
  });

  it('answers without a session, and mints none', async () => {
    await reference().index({ locale: 'en' });

    expect(await db.selectFrom('users').select('id').execute()).toHaveLength(0);
  });

  it('keeps serving a pinned version after another is imported', async () => {
    await seedReference(db, renamedArmyIndex(pack, secondVersion, 'Renamed'));
    const pinned = { locale: 'en', dataVersion: pack.dataVersion } as const;

    expect((await reference().index(pinned)).armies[0]?.name).not.toBe(
      'Renamed',
    );
    expect((await reference().index({ locale: 'en' })).armies[0]?.name).toBe(
      'Renamed',
    );
  });

  it('finds nothing for a version that was never imported', async () => {
    await expect(
      reference().index({ locale: 'en', dataVersion: secondVersion }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'notFound' });
  });

  it('finds nothing for an army the version does not hold', async () => {
    await expect(
      reference().army({ locale: 'en', id: 'no-such-army' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'notFound' });
  });
});

describe('the reference responses', () => {
  beforeEach(async () => {
    await seedReference(db, pack);
  });

  it('are cached for good when every read pins a data version', async () => {
    const pinned = { locale: 'en', dataVersion: pack.dataVersion };
    const response = await request([
      { path: 'reference.index', input: pinned },
      { path: 'reference.troopTypes', input: pinned },
    ]);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(pinnedReferenceCache);
  });

  it('are cached briefly when a read follows the current version', async () => {
    const response = await request([
      { path: 'reference.current' },
      {
        path: 'reference.index',
        input: { locale: 'en', dataVersion: pack.dataVersion },
      },
    ]);

    expect(response.headers.get('cache-control')).toBe(currentReferenceCache);
  });

  it('are not cached when the batch reaches outside the reference data', async () => {
    const response = await request([
      { path: 'reference.index', input: { locale: 'en' } },
      { path: 'army.list' },
    ]);

    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('are not cached when a read fails', async () => {
    const response = await request([
      { path: 'reference.army', input: { locale: 'en', id: 'no-such-army' } },
    ]);

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('keep the index inside the eager payload budget', async () => {
    const response = await request([
      {
        path: 'reference.index',
        input: { locale: 'en', dataVersion: pack.dataVersion },
      },
    ]);
    const body = Buffer.from(await response.arrayBuffer());

    expect(gzipSync(body).length).toBeLessThan(eagerPayloadBudgetBytes);
  });
});
