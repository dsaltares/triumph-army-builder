'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  FindingsBadge,
  FindingsPanel,
} from '@/components/builder/validation-panel';
import {
  type FantasyNameLookup,
  useFantasyFindings,
} from '@/components/fantasy/use-fantasy-findings';
import type { FantasyReading } from '@/lib/domain/army/shared-view';
import { heroLabel } from '@/lib/domain/fantasy/text-export';

type FantasyListFindingsProps = Pick<
  FantasyReading,
  'report' | 'sheet' | 'cardNames'
>;

const noAnchors: ReadonlySet<string> = new Set();

const useSheetNames = ({
  sheet,
  cardNames,
}: FantasyListFindingsProps): FantasyNameLookup => {
  const b = useTranslations('fantasyBuilder');
  return useMemo(
    () => ({
      card: (code) => cardNames[code] ?? code,
      unit: (id) => sheet.units.find((unit) => unit.id === id)?.name ?? id,
      hero: (id) => {
        const index = sheet.heroes.findIndex((hero) => hero.id === id);
        const hero = sheet.heroes[index];
        return hero ? heroLabel(hero, index, b('hero')) : id;
      },
    }),
    [sheet, cardNames, b],
  );
};

export function FantasyListFindingsBadge(props: FantasyListFindingsProps) {
  const presenter = useFantasyFindings(useSheetNames(props));
  return (
    <FindingsBadge
      report={props.report}
      anchors={noAnchors}
      presenter={presenter}
    />
  );
}

export function FantasyListFindingsPanel(props: FantasyListFindingsProps) {
  const presenter = useFantasyFindings(useSheetNames(props));
  return (
    <FindingsPanel
      report={props.report}
      anchors={noAnchors}
      presenter={presenter}
    />
  );
}
