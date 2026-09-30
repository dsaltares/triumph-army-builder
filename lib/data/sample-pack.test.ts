import { beforeAll, describe, expect, it } from 'vitest';
import { curatedOverlayProblems } from '@/lib/data/curated-overlays.ts';
import { loadCuration } from '@/lib/data/curation.ts';
import {
  buildReferencePack,
  type ReferencePack,
} from '@/lib/data/reference-pack.ts';
import { loadSnapshot, type MeshweshSnapshot } from '@/lib/data/snapshot.ts';
import { loadCatalogues } from '@/lib/data/translation-source.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { samplePack, seedReference } from '@/test/reference.ts';
import {
  sampleCuration,
  sampleCurationDirectory,
  sampleSnapshotDirectory,
  sampleTranslationsDirectory,
} from '@/test/sample.ts';

describe('the committed sample pack', () => {
  let snapshot: MeshweshSnapshot;
  let pack: ReferencePack;

  beforeAll(async () => {
    snapshot = await loadSnapshot(sampleSnapshotDirectory);
    pack = await samplePack();
  });

  it('is what yarn data:sample builds from the sample sources', async () => {
    const built = buildReferencePack({
      snapshot,
      curation: await loadCuration(sampleCurationDirectory),
      catalogues: await loadCatalogues(sampleTranslationsDirectory),
      builtAt: new Date(pack.builtAt),
    });

    expect(JSON.parse(JSON.stringify(built))).toEqual(pack);
  });

  it('carries the data version of the sample manifest', () => {
    expect(pack.dataVersion).toBe(snapshot.manifest.dataVersion);
  });

  it('has curated overlays that match the sample snapshot', () => {
    expect(curatedOverlayProblems(sampleCuration, snapshot)).toEqual([]);
  });

  it('imports into a fresh database', async () => {
    const db = createDatabase(':memory:');
    await migrateToLatest(db);

    expect(await seedReference(db, pack)).toEqual({
      dataVersion: pack.dataVersion,
      imported: true,
    });
    await db.destroy();
  });
});
