export const register = async () => {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }
  const { getLogger } = await import('./lib/logger.ts');
  const { migrateToLatest } = await import('./lib/db/migrator.ts');
  const applied = await migrateToLatest();
  getLogger('db').info({ applied }, 'Database migrated');

  const packPath = process.env.REFERENCE_PACK;
  if (packPath) {
    const { getDatabase } = await import('./lib/db/client.ts');
    const { importReferencePackFile } = await import(
      './lib/db/reference-startup.ts'
    );
    const { pack, current } = await importReferencePackFile(
      getDatabase(),
      packPath,
      { now: () => new Date() },
    );
    const logger = getLogger('reference');
    if (pack === null) {
      logger.warn({ packPath }, 'No reference pack to import');
    } else if (pack.imported) {
      logger.info({ dataVersion: pack.dataVersion }, 'Reference data imported');
    }
    if (current === null) {
      logger.error('No reference data is current');
    } else {
      logger.info({ current }, 'Reference data current');
    }
  }

  const { getAuth } = await import('./lib/auth/auth.ts');
  await getAuth().$context;

  const { startAnonymousSweep } = await import('./lib/db/anonymous.ts');
  startAnonymousSweep();

  const { startPhotoSweep } = await import('./lib/photos/sweep.ts');
  startPhotoSweep();
};
