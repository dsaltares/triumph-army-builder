import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  rawArmyList,
  snapshotFixtureFiles,
  writeSnapshotFixture,
} from '@/test/fixtures/meshwesh.ts';
import {
  sampleCurationDirectory,
  sampleSnapshotDirectory,
} from '@/test/sample.ts';

const run = promisify(execFile);

const scriptPath = fileURLToPath(
  new URL('./validate-snapshot.ts', import.meta.url),
);

const validate = (directory: string) =>
  run(process.execPath, [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    scriptPath,
    directory,
    sampleCurationDirectory,
  ]);

describe('validate-snapshot', () => {
  it('succeeds on the sample snapshot', async () => {
    const { stdout } = await validate(sampleSnapshotDirectory);

    expect(stdout).toContain('armyLists.json               8 records');
  });

  it('fails the build when a curated sub-faction note drifts', async () => {
    const directory = await writeSnapshotFixture();

    try {
      await expect(validate(directory)).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining(
          '1a Goblin Warrens has 1 sub-faction notes and no curated variants',
        ),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('fails the build on a corrupted snapshot', async () => {
    const directory = await writeSnapshotFixture({
      ...snapshotFixtureFiles(),
      'armyLists.json': [rawArmyList({ status: 'Provisional' })],
    });

    try {
      await expect(validate(directory)).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('[0].status'),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
