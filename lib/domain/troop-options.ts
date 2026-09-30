export type BattleLine = 'all' | 'half' | 'none';

export type TroopTypeMix = 'anyMix' | 'singleType';

export type TroopEntry = {
  troopTypeCode: string;
  note: string | null;
};

export type TroopOption = {
  core: string;
  troopEntries: readonly TroopEntry[];
};

const singleTypeAnnotation = 'all';

export const battleLine = ({ core }: Pick<TroopOption, 'core'>): BattleLine =>
  core === 'all' || core === 'half' ? core : 'none';

export const troopTypeMix = ({
  troopEntries,
}: Pick<TroopOption, 'troopEntries'>): TroopTypeMix =>
  troopEntries.length > 1 &&
  troopEntries.every(({ note }) => note === singleTypeAnnotation)
    ? 'singleType'
    : 'anyMix';

export const troopTypeChoices = (
  option: Pick<TroopOption, 'troopEntries'>,
): readonly (readonly string[])[] => {
  const codes = option.troopEntries.map(({ troopTypeCode }) => troopTypeCode);
  return troopTypeMix(option) === 'singleType'
    ? codes.map((code) => [code])
    : [codes];
};
