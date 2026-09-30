'use client';

import { useMemo, useState } from 'react';
import { type NamedItem, nameSearch } from '../name-search.ts';
import { useDebouncedValue } from './use-debounced-value.ts';

const searchDelayMs = 150;

export const useFuzzyFilter = <Item extends NamedItem>(
  items: readonly Item[],
) => {
  const [query, setQuery] = useState('');
  const settledQuery = useDebouncedValue(query, searchDelayMs).trim();
  const search = useMemo(() => nameSearch(items), [items]);
  const matches = useMemo(() => search(settledQuery), [search, settledQuery]);

  return { query, setQuery, settledQuery, matches };
};
