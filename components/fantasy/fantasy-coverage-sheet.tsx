'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { DraftCoverageSheet } from '@/components/builder/coverage-sheet';
import {
  Coverage,
  type CoverageTable,
  NeedsAccount,
  type SheetControl,
} from '@/components/collection/collection-coverage';
import type { CollectionEntry } from '@/lib/domain/collection/entry';
import { fantasyCoverage } from '@/lib/domain/collection/fantasy-coverage';
import type { CoverageOption } from '@/lib/domain/collection/list-coverage';
import type { FantasyReference } from '@/lib/domain/fantasy/reference';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import { fantasySheet } from '@/lib/domain/fantasy/sheet-data';
import { fantasy } from '@/lib/domain/games/fantasy';

type FantasyCoverageProps = {
  selection: FantasySelection;
  reference: FantasyReference;
};

const numberedHeroes = (
  heroes: readonly CoverageOption[],
  numbered: string,
): readonly CoverageOption[] =>
  heroes.map((option, index) => ({
    ...option,
    lines: option.lines.map((line) => ({
      ...line,
      name: line.name || `${numbered} ${index + 1}`,
    })),
  }));

function FantasyCollectionCoverage({
  selection,
  reference,
  entries,
}: FantasyCoverageProps & { entries: readonly CollectionEntry[] }) {
  const t = useTranslations('fantasyBuilder');
  const coverage = useMemo(
    () =>
      fantasyCoverage(
        selection,
        fantasySheet({ name: '', selection }, reference),
        entries,
      ),
    [selection, reference, entries],
  );
  const tables: readonly CoverageTable[] = [
    { id: 'units', name: t('units'), options: coverage.units },
    {
      id: 'heroes',
      name: t('heroes'),
      options: numberedHeroes(coverage.heroes, t('hero')),
    },
  ].filter(({ options }) => options.length > 0);
  return (
    <Coverage
      armyId={null}
      game={fantasy.game}
      summary={coverage}
      tables={tables}
    />
  );
}

export function FantasyCoverageSheet({
  control,
  ...props
}: FantasyCoverageProps & { control: SheetControl }) {
  return (
    <DraftCoverageSheet
      control={control}
      cover={(entries) =>
        entries ? (
          <FantasyCollectionCoverage {...props} entries={entries} />
        ) : (
          <NeedsAccount />
        )
      }
    />
  );
}
