import {
  type MeshweshTroopType,
  type TroopTypeCategory,
  type TroopTypeCode,
  type TroopTypeOrder,
  troopTypeCategories,
  troopTypeCodes,
} from '../data/schema.ts';
import { by } from './ordering.ts';

export type TroopTypeCost = {
  permanentCode: TroopTypeCode;
  cost: number;
};

export type TroopTypeName = {
  permanentCode: TroopTypeCode;
  displayName: string;
};

export type CombatFactors = MeshweshTroopType['combatFactors'];

export type TroopTypeFactor = {
  permanentCode: TroopTypeCode;
  combatFactors: CombatFactors;
};

export type TroopTypeCosts = Readonly<Record<TroopTypeCode, number>>;

export type TroopTypeFactors = Readonly<Record<TroopTypeCode, CombatFactors>>;

export type TroopTypeNames = Readonly<Record<TroopTypeCode, string>>;

export type TroopTypeFormation = {
  category: TroopTypeCategory;
  order: TroopTypeOrder;
};

const byTroopType = <Value>(
  values: readonly [TroopTypeCode, Value][],
  missingDescription: string,
): Readonly<Record<TroopTypeCode, Value>> => {
  const byCode = new Map(values);
  const missing = troopTypeCodes.filter((code) => !byCode.has(code));
  if (missing.length > 0) {
    throw new Error(`no ${missingDescription} for ${missing.join(', ')}`);
  }
  return Object.fromEntries(
    troopTypeCodes.map((code) => [code, byCode.get(code)]),
  ) as Readonly<Record<TroopTypeCode, Value>>;
};

export const troopTypeCosts = (
  troopTypes: readonly TroopTypeCost[],
): TroopTypeCosts =>
  byTroopType(
    troopTypes.map(({ permanentCode, cost }) => [permanentCode, cost]),
    'stand cost',
  );

export const troopTypeNames = (
  troopTypes: readonly TroopTypeName[],
): TroopTypeNames =>
  byTroopType(
    troopTypes.map(({ permanentCode, displayName }) => [
      permanentCode,
      displayName,
    ]),
    'name',
  );

export const troopTypeFactors = (
  troopTypes: readonly TroopTypeFactor[],
): TroopTypeFactors =>
  byTroopType(
    troopTypes.map(({ permanentCode, combatFactors }) => [
      permanentCode,
      combatFactors,
    ]),
    'combat factors',
  );

export type CategorisedTroopType = {
  displayName: string;
  category: TroopTypeCategory;
  order: TroopTypeOrder;
};

export type TroopTypeOrderGroup<TroopType> = {
  order: TroopTypeOrder;
  troopTypes: readonly TroopType[];
};

export type TroopTypeGroup<TroopType> = {
  category: TroopTypeCategory;
  orders: readonly TroopTypeOrderGroup<TroopType>[];
};

const closeOrderFirst = [
  'Close',
  'Open',
] as const satisfies readonly TroopTypeOrder[];

export const troopTypeGroups = <TroopType extends CategorisedTroopType>(
  troopTypes: readonly TroopType[],
): readonly TroopTypeGroup<TroopType>[] =>
  troopTypeCategories.map((category) => ({
    category,
    orders: closeOrderFirst
      .map((order) => ({
        order,
        troopTypes: troopTypes
          .filter(
            (troopType) =>
              troopType.category === category && troopType.order === order,
          )
          .sort(by((troopType) => troopType.displayName)),
      }))
      .filter((group) => group.troopTypes.length > 0),
  }));

export const baseWidths = [40, 60, 80] as const;

export type BaseWidth = (typeof baseWidths)[number];

export type StandFigures =
  | { kind: 'figures'; min: number; max: number }
  | { kind: 'modelWithCrew' };

export type TroopTypeBasing = {
  depths: Readonly<Record<BaseWidth, number>>;
  figures: StandFigures;
};

export type TroopTypeMovements = Readonly<
  Partial<Record<TroopTypeCode, number>>
>;

export const troopTypeMovements = (
  troopTypes: readonly { permanentCode: TroopTypeCode; movement?: number }[],
): TroopTypeMovements =>
  Object.fromEntries(
    troopTypes.flatMap(({ permanentCode, movement }) =>
      movement === undefined ? [] : [[permanentCode, movement]],
    ),
  );

export type TroopTypeProfile = TroopTypeFormation & {
  movement: number | null;
  basing: TroopTypeBasing | null;
};

export type TroopTypeProfiles = Readonly<
  Record<TroopTypeCode, TroopTypeProfile>
>;

export const troopTypeProfiles = (
  troopTypes: readonly (TroopTypeFormation & {
    permanentCode: TroopTypeCode;
    movement?: number;
    basing?: TroopTypeBasing;
  })[],
): TroopTypeProfiles =>
  byTroopType(
    troopTypes.map(({ permanentCode, category, order, movement, basing }) => [
      permanentCode,
      { category, order, movement: movement ?? null, basing: basing ?? null },
    ]),
    'profile',
  );
