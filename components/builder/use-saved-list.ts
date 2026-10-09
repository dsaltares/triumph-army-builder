'use client';

import { parseAsString, useQueryStates } from 'nuqs';

const builderListParsers = {
  list: parseAsString,
  draft: parseAsString,
};

export const useSavedListId = () => {
  const [{ list }, setParams] = useQueryStates(builderListParsers, {
    history: 'replace',
    urlKeys: { draft: 's' },
  });
  const setListId = (id: string | null) => setParams({ list: id, draft: null });
  return [list, setListId] as const;
};
