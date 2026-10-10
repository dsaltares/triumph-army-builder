'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  CanIBuildItSheet,
  CoverageReading,
  type SheetControl,
} from '@/components/collection/collection-coverage';
import { LoadFailure } from '@/components/load-failure';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth/client';
import { isSignedIn } from '@/lib/auth/session';
import type { ArmyList } from '@/lib/domain/army/army-list';
import type { PointCosts } from '@/lib/domain/army/points';
import type { ArmySelection } from '@/lib/domain/army/selection';
import {
  type CollectedEntry,
  collectionReading,
} from '@/lib/domain/army/shared-view';
import { armySheet } from '@/lib/domain/army/sheet';
import type {
  TroopTypeFactors,
  TroopTypeMovements,
  TroopTypeNames,
} from '@/lib/domain/troop-types';
import { describeError } from '@/lib/errors';
import { useTRPC } from '@/lib/trpc/client';

export type CoverageSheetProps = {
  armyList: ArmyList;
  selection: ArmySelection;
  costs: PointCosts;
  names: TroopTypeNames;
  factors: TroopTypeFactors;
  movement: TroopTypeMovements;
};

function DraftCoverage({
  entries,
  armyList,
  selection,
  costs,
  names,
  factors,
  movement,
}: CoverageSheetProps & { entries: readonly CollectedEntry[] | null }) {
  const collection = useMemo(
    () =>
      collectionReading(
        selection,
        armyList,
        armySheet({
          listName: armyList.name,
          armyList,
          selection,
          costs,
          names,
          factors,
          movement,
          cardNames: {},
        }),
        entries,
        [],
      ),
    [entries, armyList, selection, costs, names, factors, movement],
  );
  return <CoverageReading armyId={null} collection={collection} />;
}

function Loading() {
  const t = useTranslations('coverage');
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-4 w-3/5" aria-hidden="true" />
      <Skeleton className="h-16 w-full" aria-hidden="true" />
      <Skeleton className="h-16 w-full" aria-hidden="true" />
    </div>
  );
}

function SignedInCoverage(props: CoverageSheetProps) {
  const t = useTranslations('coverage');
  const trpc = useTRPC();
  const entries = useQuery(trpc.collection.list.queryOptions());
  if (entries.isPending) {
    return <Loading />;
  }
  if (entries.isError) {
    return (
      <LoadFailure
        title={t('loadFailed')}
        message={describeError(entries.error)}
      />
    );
  }
  return <DraftCoverage {...props} entries={entries.data} />;
}

function OpenCoverage(props: CoverageSheetProps) {
  const { data: session } = useSession();
  return isSignedIn(session) ? (
    <SignedInCoverage {...props} />
  ) : (
    <DraftCoverage {...props} entries={null} />
  );
}

export function CoverageSheet({
  control,
  ...props
}: CoverageSheetProps & { control: SheetControl }) {
  const t = useTranslations('coverage');
  const { data: session } = useSession();
  return (
    <CanIBuildItSheet
      description={t('draftDescription')}
      collectionLink={isSignedIn(session)}
      control={control}
    >
      <OpenCoverage {...props} />
    </CanIBuildItSheet>
  );
}
