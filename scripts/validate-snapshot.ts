import { assertCuratedOverlaysMatch } from '../lib/data/curated-overlays.ts';
import { loadCuration } from '../lib/data/curation.ts';
import { countRecords, loadSnapshot } from '../lib/data/snapshot.ts';
import { curationDirectory, run, snapshotDirectory } from './cli.ts';

const validate = async () => {
  const directory = process.argv[2] ?? snapshotDirectory;
  const snapshot = await loadSnapshot(directory);
  assertCuratedOverlaysMatch(
    await loadCuration(process.argv[3] ?? curationDirectory),
    snapshot,
  );
  console.log(`Validated ${directory}`);
  for (const [name, records] of Object.entries(countRecords(snapshot))) {
    console.log(`  ${name.padEnd(24)} ${String(records).padStart(5)} records`);
  }
  console.log(`  content hash ${snapshot.manifest.contentHash}`);
  console.log(`  data version ${snapshot.manifest.dataVersion}`);
};

await run(validate);
