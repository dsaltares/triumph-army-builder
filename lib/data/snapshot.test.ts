import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { topographies } from '@/lib/data/schema.ts';
import { loadSnapshot, type MeshweshSnapshot } from '@/lib/data/snapshot.ts';
import {
  rawArmyList,
  rawBattleCard,
  snapshotFixtureFiles,
  writeSnapshotFixture,
} from '@/test/fixtures/meshwesh.ts';
import { sampleSnapshot } from '@/test/sample.ts';

const fixtureDirectories: string[] = [];

const fixture = async (files: Record<string, unknown>) => {
  const directory = await writeSnapshotFixture(files);
  fixtureDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    fixtureDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('loadSnapshot, on the sample snapshot', () => {
  let snapshot: MeshweshSnapshot;

  beforeAll(async () => {
    snapshot = await sampleSnapshot();
  });

  it('parses every collection', () => {
    expect(snapshot.armyLists).toHaveLength(8);
    expect(snapshot.allyArmyLists).toHaveLength(8);
    expect(snapshot.battleCards).toHaveLength(27);
    expect(snapshot.troopTypes).toHaveLength(26);
    expect(snapshot.thematicCategories).toHaveLength(4);
    expect(Object.keys(snapshot.enemyArmyLists)).toHaveLength(8);
  });

  it('carries a data version stamped from the content hash', () => {
    expect(snapshot.manifest.dataVersion).toBe(
      `${snapshot.manifest.fetchedAt.slice(0, 10)}.${snapshot.manifest.contentHash.slice(0, 8)}`,
    );
  });

  it('strips _id and htmlText from every record', () => {
    const serialised = JSON.stringify(snapshot);

    expect(serialised).not.toContain('"_id"');
    expect(serialised).not.toContain('htmlText');
    expect(snapshot.battleCards.every((card) => card.mdText.length > 0)).toBe(
      true,
    );
  });

  it('normalises home topography whitespace', () => {
    const values = snapshot.armyLists.flatMap((armyList) =>
      armyList.homeTopographies.flatMap((topography) => topography.values),
    );

    expect(values).not.toHaveLength(0);
    expect(values.every((value) => topographies.includes(value))).toBe(true);
  });
});

describe('loadSnapshot, on a broken snapshot', () => {
  it('reports the path of a record that drifted from the schema', async () => {
    const directory = await fixture({
      ...snapshotFixtureFiles(),
      'armyLists.json': [rawArmyList({ troopOptions: [] })],
    });

    await expect(loadSnapshot(directory)).rejects.toThrow(
      /armyLists\.json does not match the expected shape \(1 issue\):\n {2}\[0\]\.troopOptions: /,
    );
  });

  it('reports an unknown field', async () => {
    const directory = await fixture({
      ...snapshotFixtureFiles(),
      'battleCards.json': [rawBattleCard({ cost: 1 })],
    });

    await expect(loadSnapshot(directory)).rejects.toThrow(
      /battleCards\.json does not match the expected shape.*Unrecognized key/s,
    );
  });

  it('reports a file it cannot read', async () => {
    const { 'troopTypes.json': _troopTypes, ...files } = snapshotFixtureFiles();
    const directory = await fixture(files);

    await expect(loadSnapshot(directory)).rejects.toThrow(
      /troopTypes\.json could not be read.*yarn sync:meshwesh/s,
    );
  });

  it('reports a file that is not JSON', async () => {
    const directory = await fixture(snapshotFixtureFiles());
    await writeFile(join(directory, 'thematicCategories.json'), '{ nope');

    await expect(loadSnapshot(directory)).rejects.toThrow(
      /thematicCategories\.json is not valid JSON/,
    );
  });

  it('reports only the first ten issues', async () => {
    const directory = await fixture({
      ...snapshotFixtureFiles(),
      'armyLists.json': Array.from({ length: 12 }, (_, index) =>
        rawArmyList({ id: `a${index}`, pointsCap: 48 }),
      ),
    });

    await expect(loadSnapshot(directory)).rejects.toThrow(
      /\(12 issues\):(\n {2}\[\d\]: [^\n]+){10}\n {2}and 2 more$/,
    );
  });

  it('reports a data version that does not match the content hash', async () => {
    const files = snapshotFixtureFiles();
    const manifest = files['manifest.json'] as Record<string, unknown>;
    const directory = await fixture({
      ...files,
      'manifest.json': { ...manifest, dataVersion: '2026-09-17.00000000' },
    });

    await expect(loadSnapshot(directory)).rejects.toThrow(
      'manifest.json carries data version 2026-09-17.00000000, which does not match content hash abcdef0123456789',
    );
  });

  it('reports a data version that is not in the expected format', async () => {
    const files = snapshotFixtureFiles();
    const manifest = files['manifest.json'] as Record<string, unknown>;
    const directory = await fixture({
      ...files,
      'manifest.json': { ...manifest, dataVersion: 'abcdef01' },
    });

    await expect(loadSnapshot(directory)).rejects.toThrow(
      /manifest\.json does not match the expected shape.*dataVersion: must look like YYYY-MM-DD\.<hash8>/s,
    );
  });

  it('reports a collection the manifest does not describe', async () => {
    const directory = await fixture({
      ...snapshotFixtureFiles(),
      'armyLists.json': [rawArmyList(), rawArmyList({ id: 'a2' })],
    });

    await expect(loadSnapshot(directory)).rejects.toThrow(
      'armyLists.json holds 2 records, manifest.json says 1',
    );
  });
});
