import { readFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { parseReferencePack } from '../lib/data/reference-pack.ts';
import { createDatabase } from '../lib/db/client.ts';
import { seedDevUser } from '../lib/db/dev-user.ts';
import { migrateToLatest } from '../lib/db/migrator.ts';
import {
  importReferencePack,
  makeReferenceCurrent,
} from '../lib/db/reference.ts';
import { e2eDatabaseUrl } from '../playwright.config.ts';

const samplePackPath = 'test/fixtures/reference/sample-pack.json';

export default async function globalSetup() {
  const db = createDatabase(e2eDatabaseUrl);
  try {
    await migrateToLatest(db);
    await seedDevUser(hashPassword, db);
    const pack = parseReferencePack(
      JSON.parse(await readFile(samplePackPath, 'utf8')),
    );
    await importReferencePack(db, pack, { now: () => new Date() });
    await makeReferenceCurrent(db, pack.dataVersion);
  } finally {
    await db.destroy();
  }
}
