import { beforeAll, describe, expect, it } from 'vitest';
import { armyDetail } from '@/test/fixtures/army.ts';
import { sampleBundle } from '@/test/sample.ts';
import { type BundleFile, bundlePaths } from './bundle.ts';
import {
  armyDetailSchema,
  armyIndexSchema,
  battleCardTextSchema,
  bundledBattleCardsSchema,
  bundledTroopTypesSchema,
} from './bundle-schema.ts';

const served = ({ contents }: BundleFile) =>
  JSON.parse(JSON.stringify(contents)) as unknown;

describe('the bundle schemas, against the generated bundle', () => {
  let files: BundleFile[];

  beforeAll(async () => {
    files = await sampleBundle();
  });

  const fileAt = (path: string) => {
    const file = files.find((candidate) => candidate.path === path);
    if (!file) {
      throw new Error(`the bundle holds no ${path}`);
    }
    return served(file);
  };

  it('parses the army index', () => {
    const index = armyIndexSchema.parse(fileAt(bundlePaths.index));

    expect(index.armies).toHaveLength(8);
  });

  it('parses every army detail file', () => {
    const details = files.filter(({ path }) => path.startsWith('armies/'));

    expect(details).toHaveLength(8);
    for (const file of details) {
      const result = armyDetailSchema.safeParse(served(file));
      expect(result.success, `${file.path}: ${result.error?.message}`).toBe(
        true,
      );
    }
  });

  it('parses the troop types and the battle cards', () => {
    expect(
      bundledTroopTypesSchema.parse(fileAt(bundlePaths.troopTypes)),
    ).toHaveLength(26);
    expect(
      bundledBattleCardsSchema.parse(fileAt(bundlePaths.battleCards)),
    ).toHaveLength(27);
  });

  it('parses the battle card text, one entry per card', () => {
    const text = battleCardTextSchema.parse(fileAt(bundlePaths.battleCardText));

    expect(Object.keys(text)).toHaveLength(27);
    expect(text.FC).toContain('#### Cost');
  });
});

describe('battleCardTextSchema', () => {
  it('refuses a file that has lost a card', () => {
    expect(battleCardTextSchema.safeParse({ FC: 'text' }).success).toBe(false);
  });
});

describe('armyDetailSchema', () => {
  it('parses an army with a sub-faction question', () => {
    const detail = armyDetail({
      subFactions: {
        army: 'Gloomdeep Goblin Warrens',
        label: 'Sub-faction',
        variants: [
          { id: 'kish', name: 'Kish' },
          { id: 'other', name: 'Other city-states' },
        ],
        rules: {
          'only Kish': { only: ['kish', { variant: 'other', from: -2800 }] },
          'not Kish': { except: ['kish'] },
        },
      },
    });

    expect(armyDetailSchema.parse(JSON.parse(JSON.stringify(detail)))).toEqual(
      detail,
    );
  });

  it('refuses a detail file missing the troop options', () => {
    const { troopOptions: _troopOptions, ...detail } = armyDetail();

    expect(armyDetailSchema.safeParse(detail).success).toBe(false);
  });

  it('refuses a detail file carrying an unknown troop type', () => {
    const detail = JSON.parse(JSON.stringify(armyDetail()));
    detail.troopOptions[0].troopEntries[0].troopTypeCode = 'XYZ';

    expect(armyDetailSchema.safeParse(detail).success).toBe(false);
  });
});
