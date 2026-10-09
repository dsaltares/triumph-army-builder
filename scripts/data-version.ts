import { parseArgs } from 'node:util';
import { loadCuration } from '../lib/data/curation.ts';
import { referenceDataVersion } from '../lib/data/reference-pack.ts';
import { loadManifest } from '../lib/data/snapshot.ts';
import { curationDirectory, run, snapshotDirectory } from './cli.ts';

const printVersion = async () => {
  const { values } = parseArgs({
    options: {
      snapshot: { type: 'string', default: snapshotDirectory },
      curation: { type: 'string', default: curationDirectory },
    },
  });
  const manifest = await loadManifest(values.snapshot);
  const { release } = await loadCuration(values.curation);
  console.log(referenceDataVersion(manifest, release));
};

await run(printVersion);
