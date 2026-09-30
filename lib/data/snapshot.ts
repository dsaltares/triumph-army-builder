import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import { dataVersionMatchesContentHash } from '../domain/data-version.ts';
import { countOf } from '../domain/plural.ts';
import { describeError } from '../errors.ts';
import { withOverflow } from '../overflow.ts';
import {
  allyArmyListSchema,
  armyListSchema,
  battleCardSchema,
  enemyArmyListsSchema,
  type MeshweshAllyArmyList,
  type MeshweshArmyList,
  type MeshweshBattleCard,
  type MeshweshEnemyArmyLists,
  type MeshweshManifest,
  type MeshweshThematicCategory,
  type MeshweshThematicCategoryArmyLists,
  type MeshweshTroopType,
  manifestSchema,
  thematicCategoryArmyListsSchema,
  thematicCategorySchema,
  troopTypeSchema,
} from './schema.ts';
import { describedIssues } from './zod-issues.ts';

export type MeshweshSnapshot = {
  manifest: MeshweshManifest;
  armyLists: MeshweshArmyList[];
  allyArmyLists: MeshweshAllyArmyList[];
  battleCards: MeshweshBattleCard[];
  troopTypes: MeshweshTroopType[];
  thematicCategories: MeshweshThematicCategory[];
  enemyArmyLists: MeshweshEnemyArmyLists;
  thematicCategoryArmyLists: MeshweshThematicCategoryArmyLists;
};

export const manifestFileName = 'manifest.json';

const maxReportedIssues = 10;

const formatIssues = (path: string, error: z.ZodError) =>
  [
    `${path} does not match the expected shape (${countOf(error.issues.length, 'issue')}):`,
    ...withOverflow(
      describedIssues(error).map((issue) => `  ${issue}`),
      maxReportedIssues,
      (remaining) => `  and ${remaining} more`,
    ),
  ].join('\n');

const parseFile = async <Output>(
  directory: string,
  name: string,
  schema: z.ZodType<Output>,
): Promise<Output> => {
  const path = join(directory, name);
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(
      `${path} could not be read: ${describeError(error)}. Run \`yarn sync:meshwesh\` to fetch the snapshot.`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${describeError(error)}`);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(formatIssues(path, result.error));
  }
  return result.data;
};

export const countRecords = (snapshot: MeshweshSnapshot) => ({
  'allyArmyLists.json': snapshot.allyArmyLists.length,
  'armyLists.json': snapshot.armyLists.length,
  'battleCards.json': snapshot.battleCards.length,
  'enemyArmyLists.json': Object.keys(snapshot.enemyArmyLists).length,
  'thematicCategories.json': snapshot.thematicCategories.length,
  'thematicCategoryArmyLists.json': Object.keys(
    snapshot.thematicCategoryArmyLists,
  ).length,
  'troopTypes.json': snapshot.troopTypes.length,
});

const checkRecordCounts = (snapshot: MeshweshSnapshot) => {
  const counts: Record<string, number> = countRecords(snapshot);
  const manifestRecords = new Map(
    snapshot.manifest.files.map((file) => [file.name, file.records]),
  );
  const mismatches = Object.entries(counts).flatMap(([name, records]) => {
    const expected = manifestRecords.get(name);
    if (expected === undefined) {
      return [`  ${name} is not listed in ${manifestFileName}`];
    }
    if (expected !== records) {
      return [
        `  ${name} holds ${records} records, ${manifestFileName} says ${expected}`,
      ];
    }
    return [];
  });
  const unknown = snapshot.manifest.files
    .filter((file) => counts[file.name] === undefined)
    .map((file) => `  ${manifestFileName} lists an unknown file ${file.name}`);
  const problems = [...mismatches, ...unknown];
  if (problems.length > 0) {
    throw new Error(
      [`${manifestFileName} does not describe the snapshot:`, ...problems].join(
        '\n',
      ),
    );
  }
};

const checkDataVersion = (manifest: MeshweshManifest) => {
  if (
    !dataVersionMatchesContentHash(manifest.dataVersion, manifest.contentHash)
  ) {
    throw new Error(
      `${manifestFileName} carries data version ${manifest.dataVersion}, which does not match content hash ${manifest.contentHash}`,
    );
  }
};

export const loadManifest = async (
  directory: string,
): Promise<MeshweshManifest> => {
  const manifest = await parseFile(directory, manifestFileName, manifestSchema);
  checkDataVersion(manifest);
  return manifest;
};

export const loadSnapshot = async (
  directory: string,
): Promise<MeshweshSnapshot> => {
  const snapshot: MeshweshSnapshot = {
    manifest: await loadManifest(directory),
    armyLists: await parseFile(
      directory,
      'armyLists.json',
      armyListSchema.array(),
    ),
    allyArmyLists: await parseFile(
      directory,
      'allyArmyLists.json',
      allyArmyListSchema.array(),
    ),
    battleCards: await parseFile(
      directory,
      'battleCards.json',
      battleCardSchema.array(),
    ),
    troopTypes: await parseFile(
      directory,
      'troopTypes.json',
      troopTypeSchema.array(),
    ),
    thematicCategories: await parseFile(
      directory,
      'thematicCategories.json',
      thematicCategorySchema.array(),
    ),
    enemyArmyLists: await parseFile(
      directory,
      'enemyArmyLists.json',
      enemyArmyListsSchema,
    ),
    thematicCategoryArmyLists: await parseFile(
      directory,
      'thematicCategoryArmyLists.json',
      thematicCategoryArmyListsSchema,
    ),
  };
  checkRecordCounts(snapshot);
  return snapshot;
};
