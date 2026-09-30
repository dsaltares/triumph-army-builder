'use client';

import { parseAsString, useQueryState } from 'nuqs';

export const savedListParser = parseAsString.withOptions({
  history: 'replace',
});

export const useSavedListId = () => useQueryState('list', savedListParser);
