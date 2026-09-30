import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Curation, curationSchema } from './curation-schema.ts';
import { summarisedIssues } from './zod-issues.ts';

export const curationFiles = {
  movement: 'movement.json',
  basing: 'basing.json',
  battleCardCosts: 'battle-card-costs.json',
  subFactions: 'sub-factions.json',
} as const satisfies Record<keyof Curation, string>;

const readCurationFile = async (directory: string, file: string) =>
  JSON.parse(await readFile(join(directory, file), 'utf8')) as unknown;

export const parseCuration = (files: Record<keyof Curation, unknown>) => {
  const result = curationSchema.safeParse(files);
  if (!result.success) {
    throw new Error(
      `the curation does not match its schema (${summarisedIssues(result.error)})`,
    );
  }
  return result.data;
};

export const loadCuration = async (directory: string): Promise<Curation> =>
  parseCuration({
    movement: await readCurationFile(directory, curationFiles.movement),
    basing: await readCurationFile(directory, curationFiles.basing),
    battleCardCosts: await readCurationFile(
      directory,
      curationFiles.battleCardCosts,
    ),
    subFactions: await readCurationFile(directory, curationFiles.subFactions),
  });
