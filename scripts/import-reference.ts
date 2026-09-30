import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { decodeReferencePack } from '../lib/data/reference-pack.ts';
import { createDatabase, databaseUrl } from '../lib/db/client.ts';
import {
  currentReferenceVersion,
  importReferencePack,
  makeReferenceCurrent,
} from '../lib/db/reference.ts';
import { run } from './cli.ts';

const usage =
  'Usage: yarn db:import-reference <path|url> [--rollback-to <version>]';

const isUrl = (location: string) => /^https?:\/\//.test(location);

const readPack = async (location: string) => {
  if (!isUrl(location)) {
    return readFile(location);
  }
  const response = await fetch(location);
  if (!response.ok) {
    throw new Error(`${location} answered ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

const importReference = async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'rollback-to': { type: 'string' } },
  });
  const [location, ...rest] = positionals;
  const rollbackTo = values['rollback-to'];
  if (rest.length > 0 || (!location && !rollbackTo)) {
    throw new Error(usage);
  }
  const db = createDatabase();
  try {
    if (location) {
      const pack = decodeReferencePack(await readPack(location));
      const { dataVersion, imported } = await importReferencePack(db, pack, {
        now: () => new Date(),
      });
      console.log(
        imported
          ? `Imported reference data ${dataVersion} into ${databaseUrl()}`
          : `Reference data ${dataVersion} is already in ${databaseUrl()}`,
      );
    }
    if (rollbackTo) {
      await makeReferenceCurrent(db, rollbackTo);
    }
    console.log(`  current: ${await currentReferenceVersion(db)}`);
  } finally {
    await db.destroy();
  }
};

await run(importReference);
