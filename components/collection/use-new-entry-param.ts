'use client';

import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import {
  type Game,
  games,
  type TroopTypeCode,
  troopTypeCodes,
} from '@/lib/data/schema';
import { heroEntryParam } from '@/lib/navigation';

export type NewEntry =
  | { kind: 'stands'; troopType: TroopTypeCode | null; game?: Game }
  | { kind: 'hero' };

const isTroopType = (code: string): code is TroopTypeCode =>
  (troopTypeCodes as readonly string[]).includes(code);

const newEntryOf = (
  param: string | null,
  game: Game | null,
): NewEntry | undefined => {
  if (param === null) {
    return undefined;
  }
  if (param === heroEntryParam) {
    return { kind: 'hero' };
  }
  return {
    kind: 'stands',
    troopType: isTroopType(param) ? param : null,
    ...(game === null ? {} : { game }),
  };
};

const paramsOf = (next: NewEntry | undefined) => {
  if (next === undefined) {
    return { new: null, game: null };
  }
  return next.kind === 'hero'
    ? { new: heroEntryParam, game: null }
    : { new: next.troopType ?? '', game: next.game ?? null };
};

const newEntryParams = {
  new: parseAsString,
  game: parseAsStringLiteral(games),
};

export const useNewEntryParam = () => {
  const [params, setParams] = useQueryStates(newEntryParams);
  const setNewEntry = (next: NewEntry | undefined) => setParams(paramsOf(next));
  return [newEntryOf(params.new, params.game), setNewEntry] as const;
};
