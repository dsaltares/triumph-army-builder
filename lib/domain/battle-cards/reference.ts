import type { BattleCardCode } from '../../data/schema.ts';
import { type BattleCardCategory, battleCardCategories } from './cost-rules.ts';

export type DescribedCard = {
  permanentCode: BattleCardCode;
  displayName: string;
  listName: string;
  category: BattleCardCategory;
  showInList: boolean;
};

export type ReferenceCard = DescribedCard & { text: string };

export type ReferenceCardGroup = {
  category: BattleCardCategory;
  cards: readonly ReferenceCard[];
};

export const battleCardReference = (
  cards: readonly DescribedCard[],
  text: Readonly<Record<BattleCardCode, string>>,
): readonly ReferenceCardGroup[] =>
  battleCardCategories.map((category) => ({
    category,
    cards: cards
      .filter((card) => card.category === category)
      .sort((left, right) => (left.displayName < right.displayName ? -1 : 1))
      .map((card) => ({ ...card, text: text[card.permanentCode] })),
  }));
