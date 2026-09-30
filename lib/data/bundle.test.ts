import { rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { BundledBattleCard, BundledTroopType } from '@/lib/data/bundle.ts';
import {
  type ArmyDetail,
  type ArmyIndex,
  type BundleFile,
  buildBundle,
  bundlePaths,
  eagerPayloadBudgetBytes,
} from '@/lib/data/bundle.ts';
import type { Curation } from '@/lib/data/curation-schema.ts';
import { loadSnapshot } from '@/lib/data/snapshot.ts';
import type { TagWord } from '@/lib/domain/collection/tag-words.ts';
import {
  rawAllyArmyList,
  snapshotFixtureFiles,
  writeSnapshotFixture,
} from '@/test/fixtures/meshwesh.ts';
import { sampleBundle, sampleCuration } from '@/test/sample.ts';

const sylvanCourtsId = 'army-sylvan-courts';
const deepWoodsId = 'category-deep-woods';

const fixtureDirectories: string[] = [];

const fixtureBundle = async (
  files: Record<string, unknown>,
  curation: Curation = sampleCuration,
) => {
  const directory = await writeSnapshotFixture(files);
  fixtureDirectories.push(directory);
  return buildBundle(await loadSnapshot(directory), curation);
};

const contentsOf = (files: readonly BundleFile[], path: string) => {
  const file = files.find((candidate) => candidate.path === path);
  if (!file) {
    throw new Error(`the bundle has no ${path}`);
  }
  return file.contents;
};

afterEach(async () => {
  await Promise.all(
    fixtureDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('buildBundle, on the sample snapshot', () => {
  let files: BundleFile[];
  let index: ArmyIndex;

  beforeAll(async () => {
    files = await sampleBundle();
    index = contentsOf(files, bundlePaths.index) as ArmyIndex;
  });

  it('ships a single eager file, inside the payload budget', () => {
    const eager = files.filter((file) => file.eager);
    const indexJson = JSON.stringify(contentsOf(files, bundlePaths.index));

    expect(eager.map(({ path }) => path)).toEqual([bundlePaths.index]);
    expect(gzipSync(indexJson).length).toBeLessThan(eagerPayloadBudgetBytes);
  });

  it('indexes every army list in upstream order', () => {
    expect(index.armies).toHaveLength(8);
    expect(index.armies.at(0)).toMatchObject({ name: 'Goblin Warrens' });
    expect(index.armies.at(-1)).toMatchObject({
      name: 'Hollow Necropolis',
    });
  });

  it('carries the meta needed to stamp a saved army', () => {
    expect(index.meta).toEqual({
      source: 'https://sample.triumph-army-builder.test/api/v1',
      fetchedAt: expect.any(String),
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('keeps only what the index route filters on', () => {
    const entry = index.armies.find(({ id }) => id === sylvanCourtsId);

    expect(entry).toEqual({
      id: sylvanCourtsId,
      key: '2a',
      name: 'Sylvan Courts',
      extendedName: 'Sylvan Courts  600 BC to 400 AD',
      status: 'Ready',
      keywords: ['Elf', 'Fey'],
      startDate: -600,
      endDate: 400,
      invasion: [expect.any(Number)],
      maneuver: [expect.any(Number)],
      topographies: ['Forest'],
      categories: [deepWoodsId],
    });
  });

  it('gives every army the thematic categories that list it', () => {
    const memberships = index.armies.flatMap(({ categories }) => categories);

    expect(index.armies.every(({ categories }) => categories.length > 0)).toBe(
      true,
    );
    expect(new Set(memberships).size).toBe(4);
    expect(memberships).toHaveLength(9);
  });

  it('writes one lazy detail file per army', () => {
    const details = files.filter(({ path }) => path.startsWith('armies/'));

    expect(details).toHaveLength(8);
    expect(details.every(({ eager }) => !eager)).toBe(true);
  });

  it('inlines the contingents, enemies and sub-factions of an army', () => {
    const detail = contentsOf(
      files,
      bundlePaths.army(sylvanCourtsId),
    ) as ArmyDetail;

    expect(detail.allyOptions).toHaveLength(1);
    expect(detail.allyContingents).toHaveLength(1);
    expect(detail.allyContingents[0]).toMatchObject({
      internalContingent: expect.any(Boolean),
      troopOptions: expect.any(Array),
    });
    expect(detail.enemies).toHaveLength(2);
    expect(detail.subFactions?.variants.map(({ id }) => id)).toEqual([
      'summer',
      'winter',
      'twilight',
      'moonfall',
      'other',
    ]);
  });

  it('splits battle card prose away from the card list', () => {
    const battleCards = contentsOf(files, bundlePaths.battleCards) as Record<
      string,
      unknown
    >[];
    const text = contentsOf(files, bundlePaths.battleCardText) as Record<
      string,
      string
    >;

    expect(battleCards).toHaveLength(27);
    expect(battleCards[0]).not.toHaveProperty('mdText');
    expect(Object.keys(text)).toHaveLength(27);
    expect(text.FC).toContain('#### Cost');
  });

  it('gives every troop type the movement and basing the curation holds', () => {
    const troopTypes = contentsOf(
      files,
      bundlePaths.troopTypes,
    ) as BundledTroopType[];

    expect(troopTypes).toHaveLength(26);
    expect(
      troopTypes.find(({ permanentCode }) => permanentCode === 'HRD'),
    ).toMatchObject({
      movement: 3,
      basing: {
        depths: { 40: 40, 60: 60, 80: 80 },
        figures: { kind: 'figures', min: 7, max: 8 },
      },
    });
  });

  it('prices every battle card from the curation, without its audit trail', () => {
    const battleCards = contentsOf(
      files,
      bundlePaths.battleCards,
    ) as BundledBattleCard[];

    expect(
      battleCards.find(({ permanentCode }) => permanentCode === 'SF'),
    ).toMatchObject({
      purchasedPer: 'troopOption',
      rule: {
        kind: 'modifiesStandCost',
        effect: { kind: 'setTo', points: 3.5 },
      },
    });
    expect(battleCards[0]).not.toHaveProperty('sources');
  });

  it('gathers the words of every troop option description into a lazy file of tag words', () => {
    const file = files.find(({ path }) => path === bundlePaths.tagWords);
    const words = file?.contents as TagWord[];

    expect(file?.eager).toBe(false);
    expect(words.length).toBeGreaterThan(100);
    expect(words[0]).toMatchObject({ word: 'riders' });
    expect(words.find(({ word }) => word === 'spear')).toMatchObject({
      troopTypes: expect.arrayContaining(['PIK', 'SPR']),
    });
  });
});

describe('buildBundle', () => {
  it('deduplicates the topographies an army is filtered by', async () => {
    const files = await fixtureBundle(snapshotFixtureFiles());
    const { armies } = contentsOf(files, bundlePaths.index) as ArmyIndex;

    expect(armies[0]?.topographies).toEqual(['Arable', 'Hilly']);
  });

  it('leaves an army with no thematic category out of every filter', async () => {
    const files = await fixtureBundle({
      ...snapshotFixtureFiles(),
      'thematicCategoryArmyLists.json': { k1: [] },
    });
    const { armies } = contentsOf(files, bundlePaths.index) as ArmyIndex;

    expect(armies[0]?.categories).toEqual([]);
  });

  it('leaves out the movement and basing the curation does not hold', async () => {
    const files = await fixtureBundle(snapshotFixtureFiles(), {
      ...sampleCuration,
      movement: {},
      basing: {},
    });
    const troopTypes = contentsOf(
      files,
      bundlePaths.troopTypes,
    ) as BundledTroopType[];

    expect(troopTypes.length).toBeGreaterThan(0);
    for (const troopType of troopTypes) {
      expect(troopType).not.toHaveProperty('movement');
      expect(troopType).not.toHaveProperty('basing');
    }
  });

  it('offers the sub-factions the curation holds for an army', async () => {
    const earlySumerian = {
      army: 'Goblin Warrens',
      label: 'Sub-faction',
      variants: [
        { id: 'kish', name: 'Kish' },
        { id: 'other', name: 'Other city-states' },
      ],
      rules: { 'only Kish': { only: ['kish'] } },
    };
    const armyIn = (files: readonly BundleFile[]) =>
      contentsOf(files, bundlePaths.army('a1')) as ArmyDetail;

    expect(
      armyIn(
        await fixtureBundle(snapshotFixtureFiles(), {
          ...sampleCuration,
          subFactions: { '1a': earlySumerian },
        }),
      ).subFactions,
    ).toEqual(earlySumerian);
    expect(
      armyIn(await fixtureBundle(snapshotFixtureFiles())).subFactions,
    ).toBeNull();
  });

  it('fails when an ally contingent is missing from the snapshot', async () => {
    await expect(
      fixtureBundle({
        ...snapshotFixtureFiles(),
        'allyArmyLists.json': [rawAllyArmyList({ id: 'c2' })],
      }),
    ).rejects.toThrow('references an ally contingent c1');
  });
});
