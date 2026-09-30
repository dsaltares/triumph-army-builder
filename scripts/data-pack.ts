import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assertCuratedOverlaysMatch } from '../lib/data/curated-overlays.ts';
import { loadCuration } from '../lib/data/curation.ts';
import {
  buildReferencePack,
  encodeReferencePack,
  referencePackFileName,
} from '../lib/data/reference-pack.ts';
import { loadSnapshot } from '../lib/data/snapshot.ts';
import { loadCatalogues } from '../lib/data/translation-source.ts';
import { locales } from '../lib/i18n/locales.ts';
import {
  curationDirectory,
  run,
  snapshotDirectory,
  translationsDirectory,
} from './cli.ts';

const defaultOutputDirectory = fileURLToPath(
  new URL('../.data/', import.meta.url),
);

const plainJsonExtension = '.json';

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const pack = async () => {
  const { values } = parseArgs({
    options: {
      snapshot: { type: 'string', default: snapshotDirectory },
      curation: { type: 'string', default: curationDirectory },
      translations: { type: 'string', default: translationsDirectory },
      out: { type: 'string' },
    },
  });
  const snapshot = await loadSnapshot(values.snapshot);
  const curation = await loadCuration(values.curation);
  assertCuratedOverlaysMatch(curation, snapshot);
  const catalogues = await loadCatalogues(values.translations);
  const referencePack = buildReferencePack({
    snapshot,
    curation,
    catalogues,
    builtAt: new Date(),
  });
  const target =
    values.out ??
    join(
      defaultOutputDirectory,
      referencePackFileName(referencePack.dataVersion),
    );
  const written = target.endsWith(plainJsonExtension)
    ? `${JSON.stringify(referencePack, null, 2)}\n`
    : encodeReferencePack(referencePack);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, written);
  console.log(`Wrote ${target}`);
  console.log(`  data version ${referencePack.dataVersion}`);
  for (const locale of locales) {
    console.log(`  ${locale}: ${referencePack.locales[locale].length} files`);
  }
  console.log(
    `  ${megabytes(Buffer.byteLength(written))}${typeof written === 'string' ? '' : ' gzipped'}`,
  );
};

await run(pack);
