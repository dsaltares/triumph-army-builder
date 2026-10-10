'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { FindingPresenter } from '@/components/builder/validation-panel';
import { fantasyFindingAnchor } from '@/components/fantasy/fantasy-anchors';
import type { FantasyFinding } from '@/lib/domain/fantasy/validation';
import {
  describeFantasyFinding,
  type FantasyFindingNames,
} from '@/lib/fantasy-findings';
import { joinWithAnd } from '@/lib/format';

export type FantasyNameLookup = Pick<
  FantasyFindingNames,
  'card' | 'unit' | 'hero'
>;

export const useFantasyFindings = (
  lookup: FantasyNameLookup,
): FindingPresenter<FantasyFinding> => {
  const t = useTranslations('fantasyFindings');
  const b = useTranslations('fantasyBuilder');
  const locale = useLocale();
  return useMemo(() => {
    const names: FantasyFindingNames = {
      ...lookup,
      army: b('theArmy'),
      join: (items) => joinWithAnd(items, locale),
    };
    return {
      describe: (finding) => describeFantasyFinding(finding, t, names),
      anchorOf: (finding) => fantasyFindingAnchor(finding.target),
    };
  }, [lookup, t, b, locale]);
};
