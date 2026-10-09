import { beforeAll, describe, expect, it } from 'vitest';
import { filesOf, memoryBundleSource } from '@/test/bundle-source.ts';
import type { BundleFiles } from '@/test/reference.ts';
import { sampleBundle } from '@/test/sample.ts';
import { bundlePaths } from './bundle.ts';
import { readFantasyCardCatalogue } from './fantasy-reference.ts';
import { fantasyCardCodes } from './schema.ts';

let files: BundleFiles;

beforeAll(async () => {
  files = filesOf(await sampleBundle());
});

describe('readFantasyCardCatalogue', () => {
  it('reads the cards, their text, the Fantasy troop names and the dense topographies', async () => {
    const catalogue = await readFantasyCardCatalogue(memoryBundleSource(files));

    expect(catalogue?.naming.cards).toHaveLength(fantasyCardCodes.length);
    expect(Object.keys(catalogue?.text ?? {})).toHaveLength(
      fantasyCardCodes.length,
    );
    expect(catalogue?.naming.troopTypeNames.ARC).toBe('Shooters');
    expect(catalogue?.naming.troopTypeNames.ELE).toBe('Behemoths');
    expect(catalogue?.naming.denseTopographies).toContain('Dense Forest');
  });

  it('is null for a pack without the Fantasy Triumph section', async () => {
    const withoutFantasy = Object.fromEntries(
      Object.entries(files).filter(
        ([path]) => path !== bundlePaths.fantasy.battleCards,
      ),
    );

    expect(
      await readFantasyCardCatalogue(memoryBundleSource(withoutFantasy)),
    ).toBeNull();
  });
});
