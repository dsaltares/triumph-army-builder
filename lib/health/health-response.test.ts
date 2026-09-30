import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { importReferencePack } from '@/lib/db/reference.ts';
import type { Database } from '@/lib/db/schema.ts';
import { samplePack } from '@/test/reference.ts';
import { healthResponse } from './health-response.ts';

let db: Kysely<Database>;

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('healthResponse', () => {
  it('fails while no reference version is current', async () => {
    const response = await healthResponse(db);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unavailable',
      reason: 'noReferenceData',
    });
  });

  it('answers with the current reference version', async () => {
    const pack = await samplePack();
    await importReferencePack(db, pack, { now: () => new Date() });

    const response = await healthResponse(db);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      status: 'ok',
      dataVersion: pack.dataVersion,
    });
  });
});
