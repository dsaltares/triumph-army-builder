import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';

export type SelectionEdit = (
  edit: (selection: FantasySelection) => FantasySelection,
) => void;
