import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { curationReleaseFile } from '../lib/data/curation.ts';
import type { CurationRelease } from '../lib/data/curation-schema.ts';
import { referenceDataVersion } from '../lib/data/reference-pack.ts';
import { loadManifest } from '../lib/data/snapshot.ts';
import { curationDirectory, run, snapshotDirectory } from './cli.ts';

const bump = async () => {
  const { values } = parseArgs({
    options: {
      snapshot: { type: 'string', default: snapshotDirectory },
      curation: { type: 'string', default: curationDirectory },
    },
  });
  const manifest = await loadManifest(values.snapshot);
  const release: CurationRelease = { bumpedAt: new Date().toISOString() };
  const target = join(values.curation, curationReleaseFile);
  await writeFile(target, `${JSON.stringify(release, null, 2)}\n`);
  console.log(`Wrote ${target}`);
  console.log(`  data version ${referenceDataVersion(manifest, release)}`);
};

await run(bump);
