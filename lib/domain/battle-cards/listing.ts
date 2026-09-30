import type { BattleCardCode } from '../../data/schema.ts';

export type ListedCard = {
  permanentCode: BattleCardCode;
  listName: string;
  showInList: boolean;
};

export type BattleCardNames = Readonly<Partial<Record<BattleCardCode, string>>>;

export const battleCardNames = (
  cards: readonly ListedCard[],
): BattleCardNames =>
  Object.fromEntries(
    cards
      .filter(({ showInList }) => showInList)
      .map(({ permanentCode, listName }) => [permanentCode, listName]),
  );

export const listedBattleCards = <Allowance extends { code: BattleCardCode }>(
  allowances: readonly Allowance[],
  names: BattleCardNames,
): readonly (Allowance & { name: string })[] =>
  allowances.flatMap((allowance) => {
    const name = names[allowance.code];
    return name ? [{ ...allowance, name }] : [];
  });
