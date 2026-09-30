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
import type { SavedArmy } from '@/lib/domain/army/saved-army';
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
  saved: SavedArmy | null;
};

type BuilderStateStore = {
  snapshot: BuilderSnapshot | null;
  publish: (snapshot: BuilderSnapshot | null) => void;
};

const BuilderStateContext = createContext<BuilderStateStore | null>(null);

const useStore = () => {
  const store = useContext(BuilderStateContext);
  if (!store) {
    throw new Error(
      'the builder state is only readable inside a BuilderStateProvider',
    );
  }
  return store;
};

export function BuilderStateProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<BuilderSnapshot | null>(null);
  const store = useMemo(() => ({ snapshot, publish: setSnapshot }), [snapshot]);
  return (
    <BuilderStateContext.Provider value={store}>
      {children}
    </BuilderStateContext.Provider>
  );
}

export const usePublishBuilderSnapshot = (snapshot: BuilderSnapshot) => {
  const { publish } = useStore();

  useEffect(() => {
    publish(snapshot);
  }, [publish, snapshot]);

  useEffect(() => () => publish(null), [publish]);
};

export const useBuilderSnapshot = () => useStore().snapshot;
