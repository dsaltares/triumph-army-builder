'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { type TroopTypeCode, troopTypeCodes } from '@/lib/data/schema';

const isTroopType = (code: string): code is TroopTypeCode =>
  (troopTypeCodes as readonly string[]).includes(code);

export const useNewEntryParam = () => {
  const [param, setParam] = useQueryState('new', parseAsString);
  const troopType: TroopTypeCode | null | undefined =
    param === null ? undefined : isTroopType(param) ? param : null;
  const setTroopType = (next: TroopTypeCode | null | undefined) =>
    setParam(next === undefined ? null : (next ?? ''));
  return [troopType, setTroopType] as const;
};
