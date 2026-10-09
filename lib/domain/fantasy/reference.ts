import type { BundledFantasyCard } from '../../data/bundle.ts';
import type {
  FantasyCardCode,
  TroopTypeCategory,
  TroopTypeCode,
  TroopTypeOrder,
} from '../../data/schema.ts';
import type { FantasyFormat } from './battle-cards.ts';

export type FantasyTroopType = {
  permanentCode: TroopTypeCode;
  displayName: string;
  cost: number;
  category: TroopTypeCategory;
  order: TroopTypeOrder;
  movement?: number;
};

export type FantasyReference = {
  troopTypes: readonly FantasyTroopType[];
  cards: readonly BundledFantasyCard[];
  format: FantasyFormat;
};

export type FantasyCatalogue = {
  troopTypes: ReadonlyMap<TroopTypeCode, FantasyTroopType>;
  cards: ReadonlyMap<FantasyCardCode, BundledFantasyCard>;
  format: FantasyFormat;
};

export const fantasyCatalogue = ({
  troopTypes,
  cards,
  format,
}: FantasyReference): FantasyCatalogue => ({
  troopTypes: new Map(
    troopTypes.map((troopType) => [troopType.permanentCode, troopType]),
  ),
  cards: new Map(cards.map((card) => [card.code, card])),
  format,
});
