import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeReferencePack } from '@/lib/data/reference-pack.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { currentReferenceVersion } from '@/lib/db/reference.ts';
import { samplePack } from '@/test/reference.ts';

const run = promisify(execFile);

const script = fileURLToPath(new URL('./seed-reference.ts', import.meta.url));

let directory: string;
let databaseFile: string;

const seedReference = (env: Record<string, string>) =>
  run(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseFile,
        HOME: directory,
        ...env,
      },
    },
  );

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'seed-reference-'));
  databaseFile = join(directory, 'db.sqlite');
  const db = createDatabase(databaseFile);
  await migrateToLatest(db);
  await db.destroy();
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('db:seed:reference', () => {
  it('seeds REFERENCE_PACK and says where it came from', async () => {
    const pack = await samplePack();
    const packFile = join(directory, 'pack.json.gz');
    await writeFile(packFile, encodeReferencePack(pack));

    const { stdout } = await seedReference({ REFERENCE_PACK: packFile });

    expect(stdout).toContain(
      `Seeded reference data ${pack.dataVersion} from REFERENCE_PACK`,
    );
    const db = createDatabase(databaseFile);
    try {
      expect(await currentReferenceVersion(db)).toBe(pack.dataVersion);
    } finally {
      await db.destroy();
    }
  });

  it('refuses to run under NODE_ENV=production', async () => {
    await expect(
      seedReference({ NODE_ENV: 'production' }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        'refuses to run with NODE_ENV=production',
      ),
    });
  });
});
