import type { BundledFantasyCard } from '../../data/bundle.ts';
import type { FantasyCardCode } from '../../data/schema.ts';
import { type TroopTypeNames, troopTypeNames } from '../troop-types.ts';
import type { FantasyReference } from './reference.ts';
import type { FantasyUnit } from './selection-schema.ts';

export const fantasyTroopTypeNames = ({
  troopTypes,
}: Pick<FantasyReference, 'troopTypes'>): TroopTypeNames =>
  troopTypeNames(troopTypes);

export const unitName = (
  { name, troopType }: Pick<FantasyUnit, 'name' | 'troopType'>,
  names: TroopTypeNames,
) => name.trim() || names[troopType];

export const fantasyCardName = (
  code: FantasyCardCode,
  card: BundledFantasyCard | undefined,
) => card?.name ?? code;

export const variantNames = (
  card: BundledFantasyCard | undefined,
  variants: Readonly<Record<string, string>> | undefined,
): readonly string[] =>
  Object.entries(card?.variants ?? {}).flatMap(([choice, options]) => {
    const option = variants?.[choice];
    const name = option === undefined ? undefined : options[option];
    return name === undefined ? [] : [name];
  });
