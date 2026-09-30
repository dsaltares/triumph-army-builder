import { run, snapshotDirectory } from './cli.ts';
import { createMeshweshClient, defaultBaseUrl } from './meshwesh/client.ts';
import { fetchSnapshot, writeSnapshot } from './meshwesh/snapshot.ts';

const enemyProgressEvery = 50;
const thematicCategoryProgressEvery = 10;

const formatBytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(2)} MB`;

const sync = async () => {
  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();
  console.log(`Fetching Meshwesh snapshot from ${defaultBaseUrl}`);

  const snapshot = await fetchSnapshot(createMeshweshClient(), {
    onCollection: (name, records) => {
      console.log(`  ${name}: ${records} records`);
    },
    onEnemyArmyLists: (fetched, total) => {
      if (fetched % enemyProgressEvery === 0 || fetched === total) {
        console.log(`  enemyArmyLists: ${fetched}/${total} armies`);
      }
    },
    onThematicCategoryArmyLists: (fetched, total) => {
      if (fetched % thematicCategoryProgressEvery === 0 || fetched === total) {
        console.log(
          `  thematicCategoryArmyLists: ${fetched}/${total} categories`,
        );
      }
    },
  });

  const manifest = await writeSnapshot(snapshotDirectory, snapshot, {
    source: defaultBaseUrl,
    fetchedAt,
  });

  console.log(`\nWrote ${snapshotDirectory}`);
  for (const file of manifest.files) {
    console.log(
      `  ${file.name.padEnd(24)} ${String(file.records).padStart(5)} records  ${formatBytes(file.bytes).padStart(9)}`,
    );
  }
  console.log(`  content hash ${manifest.contentHash}`);
  console.log(`  data version ${manifest.dataVersion}`);
  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
};

await run(sync);
