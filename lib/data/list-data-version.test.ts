import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { Database } from '@/lib/db/schema.ts';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army.ts';
import { type BundleFiles, seedDataVersion } from '@/test/reference.ts';
import { bundlePaths } from './bundle.ts';
import { currentListDataVersions } from './list-data-version.ts';

const saved = '2026-09-17.abcdef01';
const current = '2026-10-09.0badf00d';

const army = armyDetail();

const files: BundleFiles = {
  [bundlePaths.army(army.id)]: army,
  [bundlePaths.troopTypes]: [{ code: 'SPR', cost: 2 }],
  [bundlePaths.battleCards]: [{ code: 'AM', cost: 4 }],
  [bundlePaths.index]: { armies: [] },
};

const savedList = (dataVersion = saved) => ({
  game: 'triumph' as const,
  dataVersion,
  selection: fixtureSelection({ dataVersion }),
});

let db: Kysely<Database>;

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

const presented = async (list = savedList()) =>
  (await currentListDataVersions(db))(list);

describe('a list saved against an older data version', () => {
  it('is presented at the current version when nothing it reads has changed', async () => {
    await seedDataVersion(db, saved, files);
    await seedDataVersion(db, current, files);

    expect(await presented()).toEqual(savedList(current));
  });

  it('is presented at the current version when only another army changed', async () => {
    await seedDataVersion(db, saved, files);
    await seedDataVersion(db, current, {
      ...files,
      [bundlePaths.army('another-army')]: armyDetail({ id: 'another-army' }),
      [bundlePaths.index]: { armies: [{ id: 'another-army' }] },
    });

    expect(await presented()).toEqual(savedList(current));
  });

  it.each([
    ['its army', bundlePaths.army(army.id), { ...army, name: 'Revised' }],
    ['the troop types', bundlePaths.troopTypes, [{ code: 'SPR', cost: 3 }]],
    ['the battle cards', bundlePaths.battleCards, [{ code: 'AM', cost: 5 }]],
  ])('keeps its version when %s changed', async (_, path, revised) => {
    await seedDataVersion(db, saved, files);
    await seedDataVersion(db, current, { ...files, [path]: revised });

    expect(await presented()).toEqual(savedList());
  });

  it('keeps its version when its army changed in one locale only', async () => {
    await seedDataVersion(db, saved, files);
    await seedDataVersion(db, current, files, {
      es: { [bundlePaths.army(army.id)]: { ...army, name: 'Revisado' } },
    });

    expect(await presented()).toEqual(savedList());
  });

  it('keeps its version when the current version no longer has its army', async () => {
    const { [bundlePaths.army(army.id)]: _, ...withoutArmy } = files;
    await seedDataVersion(db, saved, files);
    await seedDataVersion(db, current, withoutArmy);

    expect(await presented()).toEqual(savedList());
  });

  it('keeps its version when that version was never imported', async () => {
    await seedDataVersion(db, current, files);

    expect(await presented()).toEqual(savedList());
  });
});

describe('a list that needs no promotion', () => {
  it('stays as it is when it is already at the current version', async () => {
    await seedDataVersion(db, current, files);

    expect(await presented(savedList(current))).toEqual(savedList(current));
  });

  it('stays as it is when no version is current', async () => {
    expect(await presented()).toEqual(savedList());
  });
});
