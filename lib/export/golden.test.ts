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
import { encodeSelection } from '@/lib/domain/army/share-codec';
import { armyListText, listTextFormats } from '@/lib/export/list-text';
import { armySheetResponse } from '@/lib/export/sheet-response';
import { loadSharedView } from '@/lib/share/shared-view';
import { sampleBundleHolding } from '@/test/bundle-source.ts';
import { builderArmyDetail, fixtureDataVersion } from '@/test/fixtures/army.ts';

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
    const { list, ...reading } = await sharedView();

    await expect(JSON.stringify(reading, null, 2)).toMatchFileSnapshot(
      '__golden__/shared-list.json',
    );
  });

  it.each(
    listTextFormats.flatMap((format) =>
      (['en', 'es'] as const).map((locale) => ({ format, locale })),
    ),
  )('writes the same $format text in $locale', async ({ format, locale }) => {
    const { sheet } = await sharedView();

    await expect(
      armyListText(sheet, { format, siteUrl, locale }),
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
      const body = Buffer.from(await response.arrayBuffer())
        .toString('latin1')
        .replace(renderedAt, '');

      await expect(
        createHash('sha256').update(body).digest('hex'),
      ).toMatchFileSnapshot(`__golden__/sheet.${locale}.pdf.sha256`);
    },
  );
});
