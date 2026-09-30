import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  encodeReferencePack,
  type ReferencePack,
} from '@/lib/data/reference-pack.ts';
import { renamedArmyIndex, samplePack } from '@/test/reference.ts';
import { createDatabase } from './client.ts';
import { migrateToLatest } from './migrator.ts';
import { importReferencePack, makeReferenceCurrent } from './reference.ts';
import { importReferencePackFile } from './reference-startup.ts';
import type { Database } from './schema.ts';

const secondVersion = '2026-10-01.0badf00d';

const clock = { now: () => new Date('2026-09-29T12:00:00.000Z') };

let directory: string;
let pack: ReferencePack;
let packFile: string;
let db: Kysely<Database>;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'reference-startup-'));
  pack = await samplePack();
  packFile = join(directory, 'pack.json.gz');
  await writeFile(packFile, encodeReferencePack(pack));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('importReferencePackFile', () => {
  it('imports the pack and makes its version current', async () => {
    expect(await importReferencePackFile(db, packFile, clock)).toEqual({
      pack: { dataVersion: pack.dataVersion, imported: true },
      current: pack.dataVersion,
    });
  });

  it('leaves a version the database already holds alone', async () => {
    await importReferencePackFile(db, packFile, clock);

    expect(await importReferencePackFile(db, packFile, clock)).toEqual({
      pack: { dataVersion: pack.dataVersion, imported: false },
      current: pack.dataVersion,
    });
  });

  it('keeps a rollback when the pack on disk is already imported', async () => {
    await importReferencePack(
      db,
      renamedArmyIndex(pack, secondVersion, 'Renamed'),
      clock,
    );
    await importReferencePackFile(db, packFile, clock);
    await makeReferenceCurrent(db, secondVersion);

    const { current } = await importReferencePackFile(db, packFile, clock);

    expect(current).toBe(secondVersion);
  });

  it('reports the current version when there is no pack on disk', async () => {
    await importReferencePack(db, pack, clock);

    expect(
      await importReferencePackFile(db, join(directory, 'none.gz'), clock),
    ).toEqual({ pack: null, current: pack.dataVersion });
  });

  it('reports no current version when nothing has been imported', async () => {
    expect(
      await importReferencePackFile(db, join(directory, 'none.gz'), clock),
    ).toEqual({ pack: null, current: null });
  });

  it('fails on a file that is not a pack', async () => {
    const broken = join(directory, 'broken.json.gz');
    await writeFile(broken, 'not a pack');

    await expect(importReferencePackFile(db, broken, clock)).rejects.toThrow();
  });
});
