'use client';

import { NewListDialog } from '@/components/army/new-list-dialog';
import { useSavedArmies } from '@/components/army/use-saved-armies';

export function NewListAction() {
  const { data } = useSavedArmies();
  if (!data || data.length === 0) {
    return null;
  }
  return <NewListDialog />;
}
