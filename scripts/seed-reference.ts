import { createDatabase, databaseUrl } from '../lib/db/client.ts';
import { run } from './cli.ts';
import {
  dataRepository,
  type ReferenceSeed,
  readPinnedVersion,
  referenceConfigFile,
  releaseTag,
  seedPinnedReference,
} from './pinned-reference.ts';

const describeSeed = (seed: ReferenceSeed, pinnedVersion: string) => {
  const where = databaseUrl();
  switch (seed.source) {
    case 'current':
      return [
        `Reference data ${seed.dataVersion} is already current in ${where}`,
      ];
    case 'held':
      return [`Made reference data ${seed.dataVersion} current in ${where}`];
    case 'override':
      return [
        `Seeded reference data ${seed.dataVersion} from REFERENCE_PACK into ${where}`,
      ];
    case 'cache':
      return [
        `Seeded reference data ${seed.dataVersion} from the cache into ${where}`,
      ];
    case 'release':
      return [
        `Seeded reference data ${seed.dataVersion} from release ${releaseTag(seed.dataVersion)} into ${where}`,
      ];
    case 'sample':
      return [
        `Seeded the sample pack ${seed.dataVersion} into ${where}: invented armies, not the real lists`,
        `  The real data ${pinnedVersion} could not be fetched (${seed.reason}).`,
        `  It is release ${releaseTag(pinnedVersion)} of ${dataRepository}: with access to it, run \`gh auth login\` or put REFERENCE_PACK_TOKEN in ${referenceConfigFile}, then \`yarn db:seed:reference\`.`,
      ];
  }
};

const seedReference = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'yarn db:seed:reference refuses to run with NODE_ENV=production',
    );
  }
  const pinnedVersion = await readPinnedVersion();
  const db = createDatabase();
  try {
    const seed = await seedPinnedReference({
      db,
      pinnedVersion,
      packOverride: process.env.REFERENCE_PACK || undefined,
    });
    for (const line of describeSeed(seed, pinnedVersion)) {
      console.log(line);
    }
  } finally {
    await db.destroy();
  }
};

await run(seedReference);
