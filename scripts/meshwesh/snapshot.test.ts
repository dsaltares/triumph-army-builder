import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonRecord, MeshweshClient } from './client.ts';
import {
  buildManifest,
  collectionNames,
  fetchSnapshot,
  type Snapshot,
  writeSnapshot,
} from './snapshot.ts';

const stubClient = (
  collections: Partial<Record<string, JsonRecord[]>>,
  enemyArmyLists: Record<string, string[]> = {},
  thematicCategoryArmyLists: Record<string, string[]> = {},
): MeshweshClient => ({
  fetchCollection: (path) => Promise.resolve(collections[path] ?? []),
  fetchEnemyArmyListIds: (armyListIds, onArmyFetched) => {
    armyListIds.forEach((_, index) => {
      onArmyFetched?.(index + 1, armyListIds.length);
    });
    return Promise.resolve(enemyArmyLists);
  },
  fetchThematicCategoryArmyListIds: (
    thematicCategoryIds,
    onCategoryFetched,
  ) => {
    thematicCategoryIds.forEach((_, index) => {
      onCategoryFetched?.(index + 1, thematicCategoryIds.length);
    });
    return Promise.resolve(thematicCategoryArmyLists);
  },
});

const snapshot: Snapshot = {
  collections: {
    armyLists: [{ id: 'a1', name: 'Goblin Warrens' }],
    allyArmyLists: [{ id: 'c1' }],
    battleCards: [{ id: 'b1' }],
    troopTypes: [{ id: 't1' }],
    thematicCategories: [{ id: 'k1' }],
  },
  enemyArmyLists: { b: ['a'], a: ['b'] },
  thematicCategoryArmyLists: { k1: ['a1'] },
};

const writeOptions = {
  source: 'https://example.test/api/v1',
  fetchedAt: '2026-09-17T00:00:00.000Z',
};

describe('fetchSnapshot', () => {
  it('fetches every collection sorted by id and the enemies of every army', async () => {
    const client = stubClient(
      { armyLists: [{ id: 'b' }, { id: 'a' }] },
      { a: ['b'], b: ['a'] },
    );
    const onCollection = vi.fn();
    const onEnemyArmyLists = vi.fn();

    const result = await fetchSnapshot(client, {
      onCollection,
      onEnemyArmyLists,
    });

    expect(result.collections.armyLists).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.enemyArmyLists).toEqual({ a: ['b'], b: ['a'] });
    expect(onCollection.mock.calls.map(([name]) => name)).toEqual([
      ...collectionNames,
    ]);
    expect(onEnemyArmyLists).toHaveBeenLastCalledWith(2, 2);
  });

  it('fetches the army lists of every thematic category', async () => {
    const client = stubClient(
      {
        armyLists: [{ id: 'a' }],
        thematicCategories: [{ id: 'k2' }, { id: 'k1' }],
      },
      {},
      { k1: ['a'], k2: [] },
    );
    const onThematicCategoryArmyLists = vi.fn();

    const result = await fetchSnapshot(client, {
      onThematicCategoryArmyLists,
    });

    expect(result.thematicCategoryArmyLists).toEqual({ k1: ['a'], k2: [] });
    expect(onThematicCategoryArmyLists).toHaveBeenLastCalledWith(2, 2);
  });

  it('fails loudly when a thematic category has no id', async () => {
    await expect(
      fetchSnapshot(
        stubClient({
          armyLists: [{ id: 'a' }],
          thematicCategories: [{ name: 'nameless' }],
        }),
      ),
    ).rejects.toThrow('thematicCategories[0] has no id');
  });

  it('fails loudly when an army list has no id', async () => {
    await expect(
      fetchSnapshot(stubClient({ armyLists: [{ name: 'nameless' }] })),
    ).rejects.toThrow('armyLists[0] has no id');
  });
});

describe('buildManifest', () => {
  const files = [
    { name: 'b.json', records: 1, bytes: 2, sha256: 'bbb' },
    { name: 'a.json', records: 3, bytes: 4, sha256: 'aaa' },
  ];

  it('sorts files by name and hashes their hashes', () => {
    const manifest = buildManifest({ ...writeOptions, files });

    expect(manifest.files.map((file) => file.name)).toEqual([
      'a.json',
      'b.json',
    ]);
    expect(manifest.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(buildManifest({ ...writeOptions, files: manifest.files })).toEqual(
      manifest,
    );
  });

  it('stamps a data version from the fetch date and the content hash', () => {
    const manifest = buildManifest({ ...writeOptions, files });

    expect(manifest.dataVersion).toBe(
      `2026-09-17.${manifest.contentHash.slice(0, 8)}`,
    );
  });

  it('keeps the previous data version when the content has not changed', () => {
    const previous = buildManifest({ ...writeOptions, files });

    const manifest = buildManifest({
      ...writeOptions,
      fetchedAt: '2027-01-01T00:00:00.000Z',
      files,
      previous,
    });

    expect(manifest.dataVersion).toBe(previous.dataVersion);
    expect(manifest.fetchedAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('stamps a new data version when the content has changed', () => {
    const previous = buildManifest({ ...writeOptions, files });

    const manifest = buildManifest({
      ...writeOptions,
      fetchedAt: '2027-01-01T00:00:00.000Z',
      files: [
        ...files,
        { name: 'c.json', records: 5, bytes: 6, sha256: 'ccc' },
      ],
      previous,
    });

    expect(manifest.dataVersion).toBe(
      `2027-01-01.${manifest.contentHash.slice(0, 8)}`,
    );
  });

  it('ignores the fetch timestamp when hashing content', () => {
    const later = buildManifest({
      ...writeOptions,
      fetchedAt: '2027-01-01T00:00:00.000Z',
      files,
    });

    expect(later.contentHash).toBe(
      buildManifest({ ...writeOptions, files }).contentHash,
    );
  });
});

describe('writeSnapshot', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'meshwesh-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes one file per collection plus the id maps and a manifest', async () => {
    const manifest = await writeSnapshot(directory, snapshot, writeOptions);

    expect((await readdir(directory)).sort()).toEqual([
      'allyArmyLists.json',
      'armyLists.json',
      'battleCards.json',
      'enemyArmyLists.json',
      'manifest.json',
      'thematicCategories.json',
      'thematicCategoryArmyLists.json',
      'troopTypes.json',
    ]);
    expect(manifest.source).toBe(writeOptions.source);
    expect(manifest.fetchedAt).toBe(writeOptions.fetchedAt);
    expect(
      manifest.files.find((file) => file.name === 'armyLists.json'),
    ).toMatchObject({ records: 1 });
    expect(
      JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
    ).toEqual(manifest);
  });

  it('writes formatted json with sorted enemy keys and a trailing newline', async () => {
    await writeSnapshot(directory, snapshot, writeOptions);

    const contents = await readFile(
      join(directory, 'enemyArmyLists.json'),
      'utf8',
    );

    expect(contents).toBe(
      '{\n  "a": [\n    "b"\n  ],\n  "b": [\n    "a"\n  ]\n}\n',
    );
  });

  it('produces the same content hash for the same data fetched later', async () => {
    const first = await writeSnapshot(directory, snapshot, writeOptions);
    const second = await writeSnapshot(directory, snapshot, {
      ...writeOptions,
      fetchedAt: '2027-01-01T00:00:00.000Z',
    });

    expect(second.contentHash).toBe(first.contentHash);
    expect(second.dataVersion).toBe(first.dataVersion);
  });

  it('stamps a new data version when a later fetch brings new data', async () => {
    const first = await writeSnapshot(directory, snapshot, writeOptions);
    const second = await writeSnapshot(
      directory,
      { ...snapshot, enemyArmyLists: { a: ['b', 'c'] } },
      { ...writeOptions, fetchedAt: '2027-01-01T00:00:00.000Z' },
    );

    expect(second.dataVersion).not.toBe(first.dataVersion);
    expect(second.dataVersion).toBe(
      `2027-01-01.${second.contentHash.slice(0, 8)}`,
    );
  });

  it('stamps a fresh data version when the manifest on disk is unreadable', async () => {
    await writeFile(join(directory, 'manifest.json'), '{ nope');

    const manifest = await writeSnapshot(directory, snapshot, writeOptions);

    expect(manifest.dataVersion).toBe(
      `2026-09-17.${manifest.contentHash.slice(0, 8)}`,
    );
  });

  it('changes the content hash when the data changes', async () => {
    const first = await writeSnapshot(directory, snapshot, writeOptions);
    const second = await writeSnapshot(
      directory,
      { ...snapshot, enemyArmyLists: { a: ['b', 'c'] } },
      writeOptions,
    );

    expect(second.contentHash).not.toBe(first.contentHash);
  });
});
