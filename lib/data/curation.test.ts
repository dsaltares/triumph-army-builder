import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  curationFiles,
  curationReleaseFile,
  fantasyCurationDirectory,
  fantasyCurationFiles,
  loadCuration,
} from '@/lib/data/curation.ts';
import type { FantasyCuration } from '@/lib/data/curation-schema.ts';
import { troopTypeCodes } from '@/lib/data/schema.ts';
import { baseWidths } from '@/lib/domain/troop-types.ts';
import { sampleCuration } from '@/test/sample.ts';

const { movement, basing } = sampleCuration;

const directories: string[] = [];

const sampleFantasy = sampleCuration.games.fantasy;

type FantasyFiles = Partial<Record<keyof FantasyCuration, unknown>>;

const writeFiles = async (
  directory: string,
  names: Readonly<Record<string, string>>,
  contents: Readonly<Record<string, unknown>>,
) => {
  await mkdir(directory, { recursive: true });
  for (const [key, file] of Object.entries(names)) {
    if (key in contents) {
      await writeFile(join(directory, file), JSON.stringify(contents[key]));
    }
  }
};

const curationDirectory = async (
  overrides: Partial<Record<keyof typeof curationFiles, unknown>>,
  fantasy: FantasyFiles | null = { ...sampleFantasy },
) => {
  const directory = await mkdtemp(join(tmpdir(), 'triumph-curation-'));
  directories.push(directory);
  await writeFiles(directory, curationFiles, {
    ...sampleCuration,
    ...overrides,
  });
  if (fantasy) {
    await writeFiles(
      join(directory, fantasyCurationDirectory),
      fantasyCurationFiles,
      fantasy,
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
  it('reads the curation files and the Fantasy Triumph section back as they were written', async () => {
    expect(await loadCuration(await curationDirectory({}))).toEqual(
      sampleCuration,
    );
  });

  it('reads a release bump when the curation has one, and has none otherwise', async () => {
    const directory = await curationDirectory({});

    expect((await loadCuration(directory)).release).toBeUndefined();

    await writeFile(
      join(directory, curationReleaseFile),
      JSON.stringify({ bumpedAt: '2026-10-09T16:05:00.000Z' }),
    );

    expect((await loadCuration(directory)).release).toEqual({
      bumpedAt: '2026-10-09T16:05:00.000Z',
    });
  });

  it('refuses a release bump that is not a timestamp', async () => {
    const directory = await curationDirectory({});
    await writeFile(
      join(directory, curationReleaseFile),
      JSON.stringify({ bumpedAt: 'today' }),
    );

    await expect(loadCuration(directory)).rejects.toThrow('release.bumpedAt');
  });

  it('has no Fantasy Triumph section when the curation has no directory for it', async () => {
    const curation = await loadCuration(await curationDirectory({}, null));

    expect(curation.games).toEqual({});
  });

  it('refuses a Fantasy Triumph section with a file missing', async () => {
    const { format: _format, ...withoutFormat } = sampleFantasy ?? {};
    const directory = await curationDirectory({}, withoutFormat);

    await expect(loadCuration(directory)).rejects.toThrow('format.json');
  });

  it('refuses a Fantasy Triumph card with no curation', async () => {
    const { weaken: _weaken, ...withoutWeaken } = sampleFantasy?.cards ?? {};
    const directory = await curationDirectory(
      {},
      { ...sampleFantasy, cards: withoutWeaken },
    );

    await expect(loadCuration(directory)).rejects.toThrow(
      'the curation does not match its schema (games.fantasy.cards.weaken',
    );
  });

  it('refuses a Fantasy Triumph card with no rules text', async () => {
    const { illusion: _illusion, ...withoutIllusion } =
      sampleFantasy?.text ?? {};
    const directory = await curationDirectory(
      {},
      { ...sampleFantasy, text: withoutIllusion },
    );

    await expect(loadCuration(directory)).rejects.toThrow(
      'the curation does not match its schema (games.fantasy.text.illusion',
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
