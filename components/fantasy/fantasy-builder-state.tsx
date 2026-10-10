'use client';

import { createSnapshotStore } from '@/components/builder/builder-state';
import type { FantasySavedArmy } from '@/lib/domain/army/saved-army';
import type { FantasyReference } from '@/lib/domain/fantasy/reference';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';

export type FantasyBuilderSnapshot = {
  listName: string;
  rename: (name: string) => void;
  selection: FantasySelection;
  saved: FantasySavedArmy | null;
  reference: FantasyReference;
};

const fantasyBuilderState = createSnapshotStore<FantasyBuilderSnapshot>();

export const FantasyBuilderStateProvider = fantasyBuilderState.Provider;

export const usePublishFantasySnapshot = fantasyBuilderState.usePublish;

export const useFantasySnapshot = fantasyBuilderState.useSnapshot;
