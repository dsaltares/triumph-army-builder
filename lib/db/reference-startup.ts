import { readFile } from 'node:fs/promises';
import type { Kysely } from 'kysely';
import { decodeReferencePack } from '../data/reference-pack.ts';
import {
  currentReferenceVersion,
  importReferencePack,
  type ReferenceImport,
} from './reference.ts';
import type { Database } from './schema.ts';

export type StartupReferenceImport = {
  pack: ReferenceImport | null;
  current: string | null;
};

const isMissingFile = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const readPackFile = async (path: string) => {
  try {
    return await readFile(path);
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw error;
  }
};

export const importReferencePackFile = async (
  db: Kysely<Database>,
  path: string,
  { now }: { now: () => Date },
): Promise<StartupReferenceImport> => {
  const bytes = await readPackFile(path);
  const pack = bytes
    ? await importReferencePack(db, decodeReferencePack(bytes), { now })
    : null;
  return { pack, current: await currentReferenceVersion(db) };
};
