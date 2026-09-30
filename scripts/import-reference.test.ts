import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  encodeReferencePack,
  type ReferencePack,
} from '@/lib/data/reference-pack.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { currentReferenceVersion } from '@/lib/db/reference.ts';
import { renamedArmyIndex, samplePack } from '@/test/reference.ts';

const run = promisify(execFile);

const script = fileURLToPath(new URL('./import-reference.ts', import.meta.url));

const secondVersion = '2026-10-01.0badf00d';

let directory: string;
let pack: ReferencePack;
let packFile: string;
let secondPackFile: string;
let databaseFile: string;
let server: Server;
let packUrl: string;

const importReference = (args: readonly string[]) =>
  run(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...args],
    { env: { ...process.env, DATABASE_URL: databaseFile } },
  );

const current = async () => {
  const db = createDatabase(databaseFile);
  try {
    return await currentReferenceVersion(db);
  } finally {
    await db.destroy();
  }
};

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'import-reference-'));
  pack = await samplePack();
  packFile = join(directory, 'first.json.gz');
  secondPackFile = join(directory, 'second.json.gz');
  const encoded = encodeReferencePack(pack);
  await writeFile(packFile, encoded);
  await writeFile(
    secondPackFile,
    encodeReferencePack(renamedArmyIndex(pack, secondVersion, 'Renamed')),
  );
  server = createServer((request, response) => {
    if (request.url === '/first.json.gz') {
      response.end(encoded);
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  packUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  databaseFile = join(await mkdtemp(join(directory, 'db-')), 'db.sqlite');
  const db = createDatabase(databaseFile);
  await migrateToLatest(db);
  await db.destroy();
});

describe('db:import-reference', () => {
  it('imports a pack from a file and makes it current', async () => {
    const { stdout } = await importReference([packFile]);

    expect(stdout).toContain(`Imported reference data ${pack.dataVersion}`);
    expect(await current()).toBe(pack.dataVersion);
  });

  it('says so when the pack is already imported', async () => {
    await importReference([packFile]);

    const { stdout } = await importReference([packFile]);

    expect(stdout).toContain(
      `Reference data ${pack.dataVersion} is already in`,
    );
  });

  it('imports a pack from a URL', async () => {
    await importReference([`${packUrl}/first.json.gz`]);

    expect(await current()).toBe(pack.dataVersion);
  });

  it('fails on a URL that does not answer with a pack', async () => {
    await expect(
      importReference([`${packUrl}/missing.json.gz`]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('answered 404'),
    });
  });

  it('makes an older version current again', async () => {
    await importReference([packFile]);
    await importReference([secondPackFile]);

    const { stdout } = await importReference([
      '--rollback-to',
      pack.dataVersion,
    ]);

    expect(stdout).toContain(`current: ${pack.dataVersion}`);
    expect(await current()).toBe(pack.dataVersion);
  });

  it('fails to roll back to a version it never imported', async () => {
    await expect(
      importReference(['--rollback-to', secondVersion]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('has not been imported'),
    });
  });

  it('says how to use it when given nothing to do', async () => {
    await expect(importReference([])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Usage: yarn db:import-reference'),
    });
  });
});
