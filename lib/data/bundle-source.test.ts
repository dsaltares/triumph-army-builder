import { beforeAll, describe, expect, it } from 'vitest';
import { filesOf, memoryBundleSource } from '@/test/bundle-source.ts';
import { armyDetail, armyIndexEntry } from '@/test/fixtures/army.ts';
import type { BundleFiles } from '@/test/reference.ts';
import { sampleBundle } from '@/test/sample.ts';
import { bundlePaths } from './bundle.ts';
import { documentBundleSource } from './bundle-source.ts';

describe('documentBundleSource', () => {
  let files: BundleFiles;

  beforeAll(async () => {
    files = {
      ...filesOf(
        (await sampleBundle()).filter(
          ({ path }) => !path.startsWith('armies/'),
        ),
      ),
      [bundlePaths.army('army-1')]: armyDetail(),
    };
  });

  it('reads the army index, the troop types and the battle cards', async () => {
    const source = memoryBundleSource(files);

    expect((await source.readArmyIndex()).armies).toHaveLength(8);
    expect(await source.readTroopTypes()).toHaveLength(26);
    expect(await source.readBattleCards()).toHaveLength(27);
    expect(Object.keys(await source.readBattleCardText())).toHaveLength(27);
  });

  it('reads the thematic categories', async () => {
    const categories = await memoryBundleSource(files).readThematicCategories();

    expect(categories).toHaveLength(4);
    expect(categories[0]).toMatchObject({ name: expect.any(String) });
  });

  it('reads one army by id', async () => {
    const detail = await memoryBundleSource(files).readArmyDetail('army-1');

    expect(detail?.name).toBe('Fixture Army');
  });

  it('reads every army the index lists, passing over one it does not hold', async () => {
    const details = await memoryBundleSource({
      [bundlePaths.index]: {
        meta: {
          source: 'https://meshwesh.example.test',
          fetchedAt: '2026-09-17T00:00:00.000Z',
          contentHash: 'abcdef01',
        },
        armies: [
          armyIndexEntry({ id: 'army-1' }),
          armyIndexEntry({ id: 'army-2' }),
        ],
      },
      [bundlePaths.army('army-1')]: armyDetail(),
    }).readArmyDetails();

    expect(details.map(({ id }) => id)).toEqual(['army-1']);
  });

  it('answers with nothing for an army the bundle does not hold', async () => {
    expect(await memoryBundleSource(files).readArmyDetail('army-2')).toBeNull();
  });

  it('never asks for a path an army id could steer outside the bundle', async () => {
    const asked: string[] = [];
    const source = documentBundleSource({
      read: async (path) => {
        asked.push(path);
        return null;
      },
      missing: (path) => path,
    });

    expect(await source.readArmyDetail('../../package')).toBeNull();
    expect(asked).toEqual([]);
  });

  it('says what is missing in the words the source chooses', async () => {
    const source = documentBundleSource({
      read: async () => null,
      missing: (path) => `${path} is not imported`,
    });

    await expect(source.readArmyIndex()).rejects.toThrow(
      'index.json is not imported',
    );
  });

  it('names the file that no longer matches the schema', async () => {
    const corrupted = memoryBundleSource({
      [bundlePaths.troopTypes]: [{ permanentCode: 'PIK' }],
    });

    await expect(corrupted.readTroopTypes()).rejects.toThrow(
      'troop-types.json does not match',
    );
  });
});
