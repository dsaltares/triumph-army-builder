'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { type TroopTypeCode, troopTypeCodes } from '@/lib/data/schema';

export type NewEntry =
  | { kind: 'stands'; troopType: TroopTypeCode | null }
  | { kind: 'hero' };

const heroParam = 'hero';

const isTroopType = (code: string): code is TroopTypeCode =>
  (troopTypeCodes as readonly string[]).includes(code);

const newEntryOf = (param: string | null): NewEntry | undefined => {
  if (param === null) {
    return undefined;
  }
  if (param === heroParam) {
    return { kind: 'hero' };
  }
  return { kind: 'stands', troopType: isTroopType(param) ? param : null };
};

const paramOf = (next: NewEntry | undefined) => {
  if (next === undefined) {
    return null;
  }
  return next.kind === 'hero' ? heroParam : (next.troopType ?? '');
};

export const useNewEntryParam = () => {
  const [param, setParam] = useQueryState('new', parseAsString);
  const setNewEntry = (next: NewEntry | undefined) => setParam(paramOf(next));
  return [newEntryOf(param), setNewEntry] as const;
};
