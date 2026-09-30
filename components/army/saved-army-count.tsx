'use client';

import { useSavedArmies } from '@/components/army/use-saved-armies';
import { countOf } from '@/lib/format';

export function SavedArmyCount() {
  const { data } = useSavedArmies();
  if (!data || data.length === 0) {
    return null;
  }
  return (
    <span className="text-sm text-muted-foreground tabular-nums">
      {countOf(data.length, 'list')}
    </span>
  );
}
