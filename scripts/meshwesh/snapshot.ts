import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  formatDataVersion,
  isDataVersion,
} from '../../lib/domain/data-version.ts';
import {
  type JsonRecord,
  type MeshweshClient,
  readRecordIds,
} from './client.ts';

export const collectionNames = [
  'armyLists',
  'allyArmyLists',
  'battleCards',
  'troopTypes',
  'thematicCategories',
] as const;

export type CollectionName = (typeof collectionNames)[number];

export type Snapshot = {
  collections: Record<CollectionName, JsonRecord[]>;
  enemyArmyLists: Record<string, string[]>;
  thematicCategoryArmyLists: Record<string, string[]>;
};

export type SnapshotFile = {
  name: string;
  records: number;
  bytes: number;
  sha256: string;
};

export type SnapshotManifest = {
  source: string;
  fetchedAt: string;
  dataVersion: string;
  contentHash: string;
  files: SnapshotFile[];
};

export type SnapshotProgress = {
  onCollection?: (name: CollectionName, records: number) => void;
  onEnemyArmyLists?: (fetched: number, total: number) => void;
  onThematicCategoryArmyLists?: (fetched: number, total: number) => void;
};

export const enemyArmyListsName = 'enemyArmyLists';
export const thematicCategoryArmyListsName = 'thematicCategoryArmyLists';
export const manifestFileName = 'manifest.json';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name < b.name ? -1 : 1;

const recordId = (record: JsonRecord) =>
  typeof record.id === 'string' ? record.id : '';

const sortedById = (records: readonly JsonRecord[]) =>
  [...records].sort((a, b) => (recordId(a) < recordId(b) ? -1 : 1));

const withSortedKeys = (map: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : 1)));

const serialise = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const sha256 = (contents: string) =>
  createHash('sha256').update(contents).digest('hex');

const isManifest = (value: unknown): value is SnapshotManifest => {
  const manifest = value as Partial<SnapshotManifest> | null;
  return (
    typeof manifest?.contentHash === 'string' &&
    typeof manifest.dataVersion === 'string' &&
    isDataVersion(manifest.dataVersion)
  );
};

export const fetchSnapshot = async (
  client: MeshweshClient,
  progress: SnapshotProgress = {},
): Promise<Snapshot> => {
  const collections = {} as Record<CollectionName, JsonRecord[]>;
  for (const name of collectionNames) {
    const records = sortedById(await client.fetchCollection(name));
    collections[name] = records;
    progress.onCollection?.(name, records.length);
  }
  const armyListIds = readRecordIds(collections.armyLists, 'armyLists');
  const enemyArmyLists = await client.fetchEnemyArmyListIds(
    armyListIds,
    progress.onEnemyArmyLists,
  );
  const thematicCategoryIds = readRecordIds(
    collections.thematicCategories,
    'thematicCategories',
  );
  const thematicCategoryArmyLists =
    await client.fetchThematicCategoryArmyListIds(
      thematicCategoryIds,
      progress.onThematicCategoryArmyLists,
    );
  return { collections, enemyArmyLists, thematicCategoryArmyLists };
};

export const readManifest = async (
  directory: string,
): Promise<SnapshotManifest | null> => {
  try {
    const manifest: unknown = JSON.parse(
      await readFile(join(directory, manifestFileName), 'utf8'),
    );
    return isManifest(manifest) ? manifest : null;
  } catch {
    return null;
  }
};

export const buildManifest = ({
  source,
  fetchedAt,
  files,
  previous = null,
}: {
  source: string;
  fetchedAt: string;
  files: readonly SnapshotFile[];
  previous?: SnapshotManifest | null;
}): SnapshotManifest => {
  const sorted = [...files].sort(byName);
  const contentHash = sha256(
    sorted.map((file) => `${file.sha256}  ${file.name}`).join('\n'),
  );
  return {
    source,
    fetchedAt,
    dataVersion:
      previous?.contentHash === contentHash
        ? previous.dataVersion
        : formatDataVersion({ fetchedAt, contentHash }),
    contentHash,
    files: sorted,
  };
};

export const writeSnapshot = async (
  directory: string,
  snapshot: Snapshot,
  { source, fetchedAt }: { source: string; fetchedAt: string },
): Promise<SnapshotManifest> => {
  const previous = await readManifest(directory);
  await mkdir(directory, { recursive: true });
  const payloads = [
    ...collectionNames.map((name) => ({
      name,
      records: snapshot.collections[name].length,
      contents: serialise(snapshot.collections[name]),
    })),
    {
      name: enemyArmyListsName,
      records: Object.keys(snapshot.enemyArmyLists).length,
      contents: serialise(withSortedKeys(snapshot.enemyArmyLists)),
    },
    {
      name: thematicCategoryArmyListsName,
      records: Object.keys(snapshot.thematicCategoryArmyLists).length,
      contents: serialise(withSortedKeys(snapshot.thematicCategoryArmyLists)),
    },
  ];
  const files: SnapshotFile[] = [];
  for (const payload of payloads) {
    const name = `${payload.name}.json`;
    await writeFile(join(directory, name), payload.contents);
    files.push({
      name,
      records: payload.records,
      bytes: Buffer.byteLength(payload.contents),
      sha256: sha256(payload.contents),
    });
  }
  const manifest = buildManifest({ source, fetchedAt, files, previous });
  await writeFile(join(directory, manifestFileName), serialise(manifest));
  return manifest;
};
