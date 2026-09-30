import { describe, expect, it } from 'vitest';
import { sampleSnapshot } from '@/test/sample.ts';
import { battleCardNames, listedBattleCards } from './listing.ts';

const cards = [
  { permanentCode: 'ES', listName: 'Elephant Screen', showInList: true },
  { permanentCode: 'ET', listName: 'Elephant Screen', showInList: false },
  { permanentCode: 'HL', listName: 'Hold the Line', showInList: true },
] as const;

describe('battleCardNames', () => {
  it('names only the cards a list prints', () => {
    expect(battleCardNames(cards)).toEqual({
      ES: 'Elephant Screen',
      HL: 'Hold the Line',
    });
  });
});

describe('listedBattleCards', () => {
  const names = battleCardNames(cards);

  it('keeps the allowance behind the name', () => {
    expect(
      listedBattleCards([{ code: 'HL', min: 0, max: 2, note: null }], names),
    ).toEqual([
      { code: 'HL', min: 0, max: 2, note: null, name: 'Hold the Line' },
    ]);
  });

  it('drops the half of a pair that repeats its partner', () => {
    expect(
      listedBattleCards(
        [
          { code: 'ES', min: null, max: null, note: null },
          { code: 'ET', min: null, max: null, note: null },
        ],
        names,
      ).map(({ name }) => name),
    ).toEqual(['Elephant Screen']);
  });
});

describe('the sample snapshot', () => {
  it('leaves unnamed only the three cards upstream hides from a list', async () => {
    const snapshot = await sampleSnapshot();
    const names = battleCardNames(snapshot.battleCards);
    const offered = new Set(
      snapshot.armyLists.flatMap((armyList) => [
        ...armyList.battleCardEntries.map(
          ({ battleCardCode }) => battleCardCode,
        ),
        ...armyList.troopOptions.flatMap(({ battleCardEntries }) =>
          battleCardEntries.map(({ battleCardCode }) => battleCardCode),
        ),
      ]),
    );
    const unnamed = [...offered].filter((code) => !names[code]).sort();

    expect(unnamed).toEqual(['CC', 'ET', 'SP']);
  });
});
