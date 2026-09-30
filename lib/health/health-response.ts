import type { Kysely } from 'kysely';
import { currentReferenceVersion } from '../db/reference.ts';
import type { Database } from '../db/schema.ts';

const uncached = { 'Cache-Control': 'no-store' };

export const healthResponse = async (db: Kysely<Database>) => {
  const dataVersion = await currentReferenceVersion(db);
  if (dataVersion === null) {
    return Response.json(
      { status: 'unavailable', reason: 'noReferenceData' },
      { status: 503, headers: uncached },
    );
  }
  return Response.json({ status: 'ok', dataVersion }, { headers: uncached });
};
