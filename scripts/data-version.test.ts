import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { curationReleaseFile } from '@/lib/data/curation.ts';
import { curationReleaseSchema } from '@/lib/data/curation-schema.ts';
import { referenceDataVersion } from '@/lib/data/reference-pack.ts';
import { loadManifest } from '@/lib/data/snapshot.ts';
import {
  sampleCurationDirectory,
  sampleSnapshotDirectory,
} from '@/test/sample.ts';

const run = promisify(execFile);

const node = (name: string, args: readonly string[]) =>
  run(process.execPath, [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    fileURLToPath(new URL(`./${name}`, import.meta.url)),
    '--snapshot',
    sampleSnapshotDirectory,
    ...args,
  ]);

const directories: string[] = [];

const curationCopy = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'data-version-'));
  directories.push(directory);
  await cp(sampleCurationDirectory, directory, { recursive: true });
  return directory;
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('data-version and data-bump', () => {
  it('prints the snapshot version for data that has never been bumped', async () => {
    const { dataVersion } = await loadManifest(sampleSnapshotDirectory);

    const { stdout } = await node('data-version.ts', [
      '--curation',
      await curationCopy(),
    ]);

    expect(stdout).toBe(`${dataVersion}\n`);
  });

  it('stamps a bump into the curation, and the version follows it', async () => {
    const curation = await curationCopy();
    const manifest = await loadManifest(sampleSnapshotDirectory);

    const { stdout: bumped } = await node('data-bump.ts', [
      '--curation',
      curation,
    ]);
    const release = curationReleaseSchema.parse(
      JSON.parse(await readFile(join(curation, curationReleaseFile), 'utf8')),
    );
    const expected = referenceDataVersion(manifest, release);
    const { stdout: printed } = await node('data-version.ts', [
      '--curation',
      curation,
    ]);

    expect(expected).not.toBe(manifest.dataVersion);
    expect(bumped).toContain(`data version ${expected}`);
    expect(printed).toBe(`${expected}\n`);
  });
});
