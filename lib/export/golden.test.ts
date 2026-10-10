import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BundleSource } from '@/lib/data/bundle-source';
import { createDatabase } from '@/lib/db/client';
import { migrateToLatest } from '@/lib/db/migrator';
import { insertShare } from '@/lib/db/shares';
import { buildArmyList, type TroopOption } from '@/lib/domain/army/army-list';
import {
  emptySelection,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withStands,
  withTroopBattleCard,
} from '@/lib/domain/army/selection';
import {
  encodeSelection,
  encodeShareCode,
} from '@/lib/domain/army/share-codec';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import { listText, listTextFormats } from '@/lib/export/list-text';
import { armySheetResponse } from '@/lib/export/sheet-response';
import { loadSharedView } from '@/lib/share/shared-view';
import { sampleBundleHolding } from '@/test/bundle-source.ts';
import { builderArmyDetail, fixtureDataVersion } from '@/test/fixtures/army.ts';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';

const siteUrl = 'https://triumph.example';
const detail = builderArmyDetail();
const armyList = buildArmyList(detail);

const optionAt = (index: number): TroopOption => {
  const option = armyList.main.troopOptions[index];
  if (!option) {
    throw new Error(`the builder fixture no longer has troop option ${index}`);
  }
  return option;
};

const [chariots, dwellers, raiders, knights] = [0, 1, 2, 3].map(optionAt) as [
  TroopOption,
  TroopOption,
  TroopOption,
  TroopOption,
];

const militia = armyList.contingentGroups.find(
  ({ name }) => name === 'Town militia',
);
const militiaOption = militia?.contingents[0].troopOptions[0];
if (!militia || !militiaOption) {
  throw new Error('the builder fixture no longer offers the town militia');
}

const started = emptySelection({
  army: armyList.id,
  dataVersion: fixtureDataVersion,
  year: -2850,
  variant: 'kish',
});
const stands = [
  [chariots, 'CHT', 3],
  [dwellers, 'LFT', 1],
  [dwellers, 'RBL', 1],
  [raiders, 'RDR', 2],
  [knights, 'KNT', 3],
  [militiaOption, 'HRD', 2],
] as const;

const troopCards = [
  [chariots, 'SS', 3],
  [knights, 'SF', 3],
  [knights, 'DD', 1],
] as const;

const stood = stands.reduce(
  (selected, [option, troopType, count]) =>
    withStands(selected, option, troopType, count),
  withContingentGroup(started, militia),
);

const selection = withArmyBattleCard(
  troopCards.reduce(
    (selected, [option, code, count]) =>
      withTroopBattleCard(selected, option, code, count),
    withGeneral(stood, { option: chariots.id, troopType: 'CHT' }),
  ),
  'FC',
  1,
);

const renderedAt = /\(D:\d{14}Z\)|\/ID \[<\w+> <\w+>\]/g;

const pdfDigest = async (response: Response) =>
  createHash('sha256')
    .update(
      Buffer.from(await response.arrayBuffer())
        .toString('latin1')
        .replace(renderedAt, ''),
    )
    .digest('hex');

let bundle: BundleSource;
let db: ReturnType<typeof createDatabase>;

beforeAll(async () => {
  bundle = await sampleBundleHolding(detail);
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values({
      id: 'user-golden',
      name: 'user-golden',
      email: 'user-golden@example.test',
      image: null,
    })
    .execute();
});

afterAll(async () => {
  await db.destroy();
});

const sharedView = async () => {
  const { id } = await insertShare(db, {
    userId: 'user-golden',
    name: 'Kish at dawn',
    selection,
    at: '2026-09-20T10:00:00.000Z',
  });
  return loadedShare(id);
};

const loadedShare = async (id: string) => {
  const view = await loadSharedView({
    db,
    bundle,
    id,
    now: () => new Date('2026-09-20T10:00:00.000Z'),
  });
  if (!view) {
    throw new Error('the golden share did not load');
  }
  return view;
};

describe('the golden fixture list', () => {
  it('reads the same on a shared list', async () => {
    const { list, game, ...reading } = await sharedView();

    await expect(JSON.stringify(reading, null, 2)).toMatchFileSnapshot(
      '__golden__/shared-list.json',
    );
  });

  it.each(
    listTextFormats.flatMap((format) =>
      (['en', 'es'] as const).map((locale) => ({ format, locale })),
    ),
  )('writes the same $format text in $locale', async ({ format, locale }) => {
    await expect(
      listText(await sharedView(), { format, siteUrl, locale }),
    ).toMatchFileSnapshot(`__golden__/list.${locale}.${format}.txt`);
  });

  it.each(['en', 'es'] as const)(
    'prints the same PDF sheet in %s',
    async (locale) => {
      const response = await armySheetResponse({
        request: new Request(
          `${siteUrl}/api/armies/${armyList.id}/sheet?s=${encodeURIComponent(encodeSelection(selection))}&name=${encodeURIComponent('Kish at dawn')}`,
        ),
        armyId: armyList.id,
        bundle,
        locale,
        siteUrl,
        generatedAt: new Date('2026-09-20T00:00:00Z'),
      });
      await expect(await pdfDigest(response)).toMatchFileSnapshot(
        `__golden__/sheet.${locale}.pdf.sha256`,
      );
    },
  );
});

const goblinRaid: FantasySelection = fantasySelection({
  format: {
    pointsTotal: 51,
    topography: 'Dense Forest',
    invasion: 4,
    maneuver: 3,
  },
  units: [
    fantasyUnit('wargs', 'JCV', {
      name: 'Warg riders',
      stands: 4,
      cards: cards('fierce', {
        code: 'terrainAffinity',
        note: 'Woods, hills',
      }),
    }),
    fantasyUnit('archers', 'ARC', {
      name: 'Goblin archers',
      stands: 4,
      cards: cards('craven'),
      marks: { delayedEntry: 2, eventCards: { holdTheLine: 2 } },
    }),
    fantasyUnit('trolls', 'WRR', {
      name: 'Cave trolls',
      stands: 2,
      cards: cards('massive', 'regenerate'),
    }),
  ],
  heroes: [
    fantasyHero('boss', {
      name: 'Grishnak',
      cards: cards('deadly', 'prowess', 'champion', 'hearten'),
    }),
  ],
  armyCards: [
    { code: 'fortifiedCamp', variants: { defenses: 'heavily' } },
    { code: 'ambush', variants: { reach: 'home' } },
    { code: 'preparedDefenses', count: 2 },
  ],
  general: 'wargs',
});

const fantasyView = async () => {
  const { id } = await insertShare(db, {
    userId: 'user-golden',
    name: 'Goblin raid',
    game: 'fantasy',
    selection: goblinRaid,
    at: '2026-09-20T10:00:00.000Z',
  });
  const view = await loadedShare(id);
  if (view.game !== 'fantasy') {
    throw new Error('the Fantasy golden share loaded as another game');
  }
  return view;
};

describe('the golden Fantasy Triumph list', () => {
  it('prices every line the way a player does by hand', async () => {
    const { sheet } = await fantasyView();

    expect(
      sheet.units.map(({ name, pointsPerStand, points }) => ({
        name,
        pointsPerStand,
        points,
      })),
    ).toEqual([
      { name: 'Warg riders', pointsPerStand: 4 - 0.5 + 1, points: 18 },
      { name: 'Goblin archers', pointsPerStand: 4 - 0.5, points: 14 },
      { name: 'Cave trolls', pointsPerStand: 3 + 1 + 1, points: 10 },
    ]);
    expect(sheet.heroes.map(({ points }) => points)).toEqual([
      1 + 2 + 1 + 1 + 1,
    ]);
    expect(sheet.format.invasion).toEqual({ rating: 4, points: -1 });
    expect(sheet.format.maneuver).toEqual({ rating: 3, points: 1 });
    expect(
      sheet.armyCards.map(({ code, count, bearer, points }) => ({
        code,
        count,
        bearer,
        points,
      })),
    ).toEqual([
      { code: 'fortifiedCamp', count: 1, bearer: null, points: 2 },
      { code: 'ambush', count: 1, bearer: null, points: 2 },
      { code: 'preparedDefenses', count: 2, bearer: null, points: 2 },
      { code: 'holdTheLine', count: 2, bearer: 'Goblin archers', points: 1 },
      {
        code: 'delayedEntry',
        count: 2,
        bearer: 'Goblin archers',
        points: -2 * 2,
      },
    ]);
    expect(sheet.totals).toEqual({
      stands: 10,
      heroes: 1,
      victoryValue: 18 + 14 + 10 + 6,
      total: 48 - 1 + 1 + 2 + 2 + 2 + 1 - 4,
      pointsTotal: 51,
    });
  });

  it('reads the same on a shared list', async () => {
    const { list, game, ...reading } = await fantasyView();

    await expect(JSON.stringify(reading, null, 2)).toMatchFileSnapshot(
      '__golden__/fantasy-shared-list.json',
    );
  });

  it.each(
    listTextFormats.flatMap((format) =>
      (['en', 'es'] as const).map((locale) => ({ format, locale })),
    ),
  )('writes the same $format text in $locale', async ({ format, locale }) => {
    await expect(
      listText(await fantasyView(), { format, siteUrl, locale }),
    ).toMatchFileSnapshot(`__golden__/fantasy-list.${locale}.${format}.txt`);
  });

  it.each(['en', 'es'] as const)(
    'prints the same PDF sheet in %s',
    async (locale) => {
      const response = await armySheetResponse({
        request: new Request(
          `${siteUrl}/api/lists/sheet?s=${encodeURIComponent(encodeShareCode({ game: 'fantasy', selection: goblinRaid }))}&name=${encodeURIComponent('Goblin raid')}`,
        ),
        bundle,
        locale,
        siteUrl,
        generatedAt: new Date('2026-09-20T00:00:00Z'),
      });

      expect(response.headers.get('content-type')).toBe('application/pdf');
      await expect(await pdfDigest(response)).toMatchFileSnapshot(
        `__golden__/fantasy-sheet.${locale}.pdf.sha256`,
      );
    },
  );
});
