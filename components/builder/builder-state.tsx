'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ArmyList } from '@/lib/domain/army/army-list';
import type { PointCosts } from '@/lib/domain/army/points';
import type { TriumphSavedArmy } from '@/lib/domain/army/saved-army';
import type { ArmySelection } from '@/lib/domain/army/selection';
import type {
  TroopTypeFactors,
  TroopTypeMovements,
  TroopTypeNames,
} from '@/lib/domain/troop-types';

export type BuilderSnapshot = {
  dataVersion: string;
  armyList: ArmyList;
  listName: string;
  rename: (name: string) => void;
  selection: ArmySelection;
  replaceSelection: (selection: ArmySelection) => void;
  costs: PointCosts;
  names: TroopTypeNames;
  factors: TroopTypeFactors;
  movement: TroopTypeMovements;
  saved: TriumphSavedArmy | null;
};

type SnapshotStore<Snapshot> = {
  snapshot: Snapshot | null;
  publish: (snapshot: Snapshot | null) => void;
};

export const createSnapshotStore = <Snapshot,>() => {
  const StoreContext = createContext<SnapshotStore<Snapshot> | null>(null);

  const useStore = () => {
    const store = useContext(StoreContext);
    if (!store) {
      throw new Error(
        'the builder state is only readable inside its state provider',
      );
    }
    return store;
  };

  function Provider({ children }: { children: ReactNode }) {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const store = useMemo(
      () => ({ snapshot, publish: setSnapshot }),
      [snapshot],
    );
    return (
      <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    );
  }

  const usePublish = (snapshot: Snapshot) => {
    const { publish } = useStore();

    useEffect(() => {
      publish(snapshot);
    }, [publish, snapshot]);

    useEffect(() => () => publish(null), [publish]);
  };

  const useSnapshot = () => useStore().snapshot;

  return { Provider, usePublish, useSnapshot };
};

const triumphBuilderState = createSnapshotStore<BuilderSnapshot>();

export const BuilderStateProvider = triumphBuilderState.Provider;

export const usePublishBuilderSnapshot = triumphBuilderState.usePublish;

export const useBuilderSnapshot = triumphBuilderState.useSnapshot;
