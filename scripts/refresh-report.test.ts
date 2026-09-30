import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { loadManifest } from '@/lib/data/snapshot.ts';
import {
  snapshotFixtureFiles,
  writeSnapshotFixture,
} from '@/test/fixtures/meshwesh.ts';
import { sampleSnapshotDirectory } from '@/test/sample.ts';

const run = promisify(execFile);

const scriptPath = fileURLToPath(
  new URL('./refresh-report.ts', import.meta.url),
);

const report = async (previousDirectory: string, currentDirectory?: string) => {
  const outputPath = join(
    await mkdtemp(join(tmpdir(), 'refresh-report-')),
    'outputs.txt',
  );
  const { stdout } = await run(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      scriptPath,
      previousDirectory,
      ...(currentDirectory ? [currentDirectory] : []),
    ],
    { env: { ...process.env, GITHUB_OUTPUT: outputPath } },
  );
  return { body: stdout, outputs: await readFile(outputPath, 'utf8') };
};

const writePreviousManifest = async (
  overrides: Record<string, unknown> = {},
) => {
  const manifest = snapshotFixtureFiles()['manifest.json'] as Record<
    string,
    unknown
  >;
  return writeSnapshotFixture({
    'manifest.json': {
      ...manifest,
      dataVersion: '2026-09-10.9999aaaa',
      contentHash: '9999aaaa00000000',
      ...overrides,
    },
  });
};

describe('refresh-report', () => {
  it('reports nothing to review when the content hash is unchanged', async () => {
    const { body, outputs } = await report(
      sampleSnapshotDirectory,
      sampleSnapshotDirectory,
    );

    expect(body).toContain('No upstream change');
    expect(outputs).toContain('changed=false');
    expect(outputs).toContain('drift=false');
  });

  it('counts records against the previous manifest', async () => {
    const { dataVersion } = await loadManifest(sampleSnapshotDirectory);
    const previousDirectory = await writePreviousManifest();

    try {
      const { body, outputs } = await report(
        previousDirectory,
        sampleSnapshotDirectory,
      );

      expect(body).toContain(`\`2026-09-10.9999aaaa\` → \`${dataVersion}\``);
      expect(body).toContain('| `armyLists.json` | 8 | +7 |');
      expect(outputs).toContain('changed=true');
      expect(outputs).toContain(`version=${dataVersion}`);
    } finally {
      await rm(previousDirectory, { recursive: true, force: true });
    }
  });
});
