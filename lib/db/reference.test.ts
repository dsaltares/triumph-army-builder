import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bundlePaths } from '@/lib/data/bundle.ts';
import type { ReferencePack } from '@/lib/data/reference-pack.ts';
import { locales } from '@/lib/i18n/locales.ts';
import { filesOf, memoryBundleSource } from '@/test/bundle-source.ts';
import { renamedArmyIndex, samplePack } from '@/test/reference.ts';
import { createDatabase } from './client.ts';
import { migrateToLatest } from './migrator.ts';
import {
  currentReferenceVersion,
  databaseBundleSource,
  importReferencePack,
  makeReferenceCurrent,
} from './reference.ts';
import type { Database } from './schema.ts';

const secondVersion = '2026-10-01.0badf00d';

const renamedArmy = 'Renamed in the second version';

const importedAt = new Date('2026-09-29T12:00:00.000Z');

const clock = { now: () => importedAt };

let pack: ReferencePack;
let db: Kysely<Database>;

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

const storedRows = () =>
  db
    .selectFrom('reference_documents')
    .selectAll()
    .orderBy(['data_version', 'locale', 'path'])
    .execute();

const armyIds = (locale: (typeof locales)[number]) =>
  pack.locales[locale]
    .filter(({ path }) => path.startsWith('armies/'))
    .map(({ path }) => path.slice('armies/'.length, -'.json'.length));

describe('the database bundle source', () => {
  it.each(locales)(
    'returns what the pack holds, for every %s file',
    async (locale) => {
      await importReferencePack(db, pack, clock);
      const files = memoryBundleSource(filesOf(pack.locales[locale]));
      const database = databaseBundleSource(db, locale);

      expect(await database.readArmyIndex()).toEqual(
        await files.readArmyIndex(),
      );
      expect(await database.readTroopTypes()).toEqual(
        await files.readTroopTypes(),
      );
      expect(await database.readBattleCards()).toEqual(
        await files.readBattleCards(),
      );
      expect(await database.readBattleCardText()).toEqual(
        await files.readBattleCardText(),
      );
      expect(await database.readThematicCategories()).toEqual(
        await files.readThematicCategories(),
      );
      expect(await database.readArmyDetails()).toEqual(
        await files.readArmyDetails(),
      );
      for (const id of armyIds(locale)) {
        expect(await database.readArmyDetail(id)).toEqual(
          await files.readArmyDetail(id),
        );
      }
    },
  );

  it('stores every file of every locale exactly as the pack holds it', async () => {
    await importReferencePack(db, pack, clock);

    const rows = await storedRows();

    expect(rows).toHaveLength(
      locales.reduce((total, locale) => total + pack.locales[locale].length, 0),
    );
    for (const locale of locales) {
      const files = filesOf(pack.locales[locale]);
      for (const { path, body } of rows.filter(
        (row) => row.locale === locale,
      )) {
        expect(JSON.parse(body)).toEqual(files[path]);
      }
    }
  });

  it('answers with nothing for an army the version does not hold', async () => {
    await importReferencePack(db, pack, clock);

    expect(
      await databaseBundleSource(db, 'en').readArmyDetail('no-such-army'),
    ).toBeNull();
  });

  it('parses a file once for as long as its version is current', async () => {
    await importReferencePack(db, pack, clock);
    const source = databaseBundleSource(db, 'en');

    expect(await source.readArmyIndex()).toBe(await source.readArmyIndex());
  });

  it('says how to import data when no version is current', async () => {
    await expect(
      databaseBundleSource(db, 'en').readArmyIndex(),
    ).rejects.toThrow('yarn db:import-reference');
  });

  it('names the file a pinned version does not hold', async () => {
    await expect(
      databaseBundleSource(db, 'es', secondVersion).readTroopTypes(),
    ).rejects.toThrow(
      `${bundlePaths.troopTypes} is missing from reference data ${secondVersion} in es`,
    );
  });

  it('follows an import made through another connection without a restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'triumph-reference-db-'));
    const file = join(directory, 'db.sqlite');
    const server = createDatabase(file);
    const importer = createDatabase(file);
    try {
      await migrateToLatest(server);
      await importReferencePack(importer, pack, clock);
      const source = databaseBundleSource(server, 'en');
      const before = (await source.readArmyIndex()).armies[0]?.name;

      await importReferencePack(
        importer,
        renamedArmyIndex(pack, secondVersion, renamedArmy),
        clock,
      );

      expect(before).not.toBe(renamedArmy);
      expect((await source.readArmyIndex()).armies[0]?.name).toBe(renamedArmy);
    } finally {
      await server.destroy();
      await importer.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('importing a reference pack', () => {
  it('makes the version it imports current', async () => {
    expect(await importReferencePack(db, pack, clock)).toEqual({
      dataVersion: pack.dataVersion,
      imported: true,
    });
    expect(await currentReferenceVersion(db)).toBe(pack.dataVersion);
  });

  it('records where the version came from and when it arrived', async () => {
    await importReferencePack(db, pack, clock);

    expect(
      await db.selectFrom('reference_versions').selectAll().execute(),
    ).toEqual([
      {
        data_version: pack.dataVersion,
        source: pack.source,
        built_at: pack.builtAt,
        imported_at: importedAt.toISOString(),
      },
    ]);
  });

  it('changes nothing when the same pack is imported twice', async () => {
    await importReferencePack(db, pack, clock);
    const versions = await db
      .selectFrom('reference_versions')
      .selectAll()
      .execute();
    const rows = await storedRows();

    expect(
      await importReferencePack(db, pack, {
        now: () => new Date('2026-12-25T00:00:00.000Z'),
      }),
    ).toEqual({ dataVersion: pack.dataVersion, imported: false });
    expect(
      await db.selectFrom('reference_versions').selectAll().execute(),
    ).toEqual(versions);
    expect(await storedRows()).toEqual(rows);
  });

  it('leaves the first version readable after a second is imported', async () => {
    await importReferencePack(db, pack, clock);
    await importReferencePack(
      db,
      renamedArmyIndex(pack, secondVersion, renamedArmy),
      clock,
    );

    const first = await databaseBundleSource(
      db,
      'en',
      pack.dataVersion,
    ).readArmyIndex();
    const current = await databaseBundleSource(db, 'en').readArmyIndex();

    expect(await currentReferenceVersion(db)).toBe(secondVersion);
    expect(current.armies[0]?.name).toBe(renamedArmy);
    expect(first.armies[0]?.name).not.toBe(renamedArmy);
  });

  it('writes nothing when one of its files cannot be stored', async () => {
    const broken = {
      ...pack,
      locales: {
        ...pack.locales,
        en: [...pack.locales.en, ...pack.locales.en.slice(0, 1)],
      },
    };

    await expect(importReferencePack(db, broken, clock)).rejects.toThrow();

    expect(
      await db.selectFrom('reference_versions').selectAll().execute(),
    ).toEqual([]);
    expect(await storedRows()).toEqual([]);
    expect(await currentReferenceVersion(db)).toBeNull();
  });
});

describe('making an older version current again', () => {
  it('serves the older version from then on', async () => {
    await importReferencePack(db, pack, clock);
    await importReferencePack(
      db,
      renamedArmyIndex(pack, secondVersion, renamedArmy),
      clock,
    );
    const source = databaseBundleSource(db, 'en');
    expect((await source.readArmyIndex()).armies[0]?.name).toBe(renamedArmy);

    await makeReferenceCurrent(db, pack.dataVersion);

    expect(await currentReferenceVersion(db)).toBe(pack.dataVersion);
    expect((await source.readArmyIndex()).armies[0]?.name).not.toBe(
      renamedArmy,
    );
  });

  it('stays there when the newer pack is imported again', async () => {
    await importReferencePack(db, pack, clock);
    const newer = renamedArmyIndex(pack, secondVersion, renamedArmy);
    await importReferencePack(db, newer, clock);
    await makeReferenceCurrent(db, pack.dataVersion);

    await importReferencePack(db, newer, clock);

    expect(await currentReferenceVersion(db)).toBe(pack.dataVersion);
  });

  it('refuses a version that was never imported', async () => {
    await importReferencePack(db, pack, clock);

    await expect(makeReferenceCurrent(db, secondVersion)).rejects.toThrow(
      `Reference data ${secondVersion} has not been imported`,
    );
    expect(await currentReferenceVersion(db)).toBe(pack.dataVersion);
  });
});
