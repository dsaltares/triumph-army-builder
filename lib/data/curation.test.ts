import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { curationFiles, loadCuration } from '@/lib/data/curation.ts';
import { troopTypeCodes } from '@/lib/data/schema.ts';
import { baseWidths } from '@/lib/domain/troop-types.ts';
import { sampleCuration } from '@/test/sample.ts';

const { movement, basing } = sampleCuration;

const directories: string[] = [];

const curationDirectory = async (
  overrides: Partial<Record<keyof typeof curationFiles, unknown>>,
) => {
  const directory = await mkdtemp(join(tmpdir(), 'triumph-curation-'));
  directories.push(directory);
  const files = { ...sampleCuration, ...overrides };
  for (const [key, file] of Object.entries(curationFiles)) {
    await writeFile(
      join(directory, file),
      JSON.stringify(files[key as keyof typeof curationFiles]),
    );
  }
  return directory;
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('the curated movement', () => {
  it('moves every troop type', () => {
    expect(Object.keys(movement).sort()).toEqual([...troopTypeCodes].sort());
  });

  it('reads the movement of the rulebook', () => {
    expect(movement).toMatchObject({ HBW: 8, KNT: 5, SPR: 3, ART: 2 });
  });
});

describe('the curated basing', () => {
  it('bases every troop type', () => {
    expect(Object.keys(basing).sort()).toEqual([...troopTypeCodes].sort());
  });

  it('makes a base deeper as it gets wider', () => {
    for (const troopType of Object.values(basing)) {
      const byWidth = baseWidths.map((width) => troopType.depths[width]);
      expect(byWidth).toEqual([...byWidth].sort((a, b) => a - b));
      expect(new Set(byWidth).size).toBe(baseWidths.length);
    }
  });

  it('reads the depths and figures of Appendix A', () => {
    expect(basing.SPR).toEqual({
      depths: { 40: 15, 60: 20, 80: 30 },
      figures: { kind: 'figures', min: 4, max: 4 },
    });
    expect(basing.BLV).toEqual({
      depths: { 40: 30, 60: 40, 80: 60 },
      figures: { kind: 'figures', min: 3, max: 3 },
    });
    expect(basing.HRD).toEqual({
      depths: { 40: 40, 60: 60, 80: 80 },
      figures: { kind: 'figures', min: 7, max: 8 },
    });
    expect(basing.ELE).toEqual({
      depths: { 40: 40, 60: 60, 80: 80 },
      figures: { kind: 'modelWithCrew' },
    });
  });
});

describe('loadCuration', () => {
  it('reads the four curation files back as they were written', async () => {
    expect(await loadCuration(await curationDirectory({}))).toEqual(
      sampleCuration,
    );
  });

  it('leaves out the movement and basing it is not given', async () => {
    const curation = await loadCuration(
      await curationDirectory({ movement: {}, basing: {} }),
    );

    expect(curation.movement).toEqual({});
    expect(curation.basing).toEqual({});
  });

  it('refuses a cost rule it does not know', async () => {
    const directory = await curationDirectory({
      battleCardCosts: {
        ...sampleCuration.battleCardCosts,
        FC: {
          ...sampleCuration.battleCardCosts.FC,
          rule: { kind: 'perMoon', points: 1 },
        },
      },
    });

    await expect(loadCuration(directory)).rejects.toThrow(
      'the curation does not match its schema',
    );
  });

  it('refuses battle card costs that leave a card out', async () => {
    const { SF, ...withoutSwordFighting } = sampleCuration.battleCardCosts;
    const directory = await curationDirectory({
      battleCardCosts: withoutSwordFighting,
    });

    await expect(loadCuration(directory)).rejects.toThrow(
      'the curation does not match its schema',
    );
  });
});
