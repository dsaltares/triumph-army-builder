'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { BuilderSnapshot } from '@/components/builder/builder-state';
import { startBuilding } from '@/lib/domain/army/builder';
import { type ArmyFill, randomFill } from '@/lib/domain/army/feasibility';
import { triumphRules } from '@/lib/domain/games/triumph-rules';

export type RandomizeListInput = Pick<
  BuilderSnapshot,
  'dataVersion' | 'armyList' | 'selection' | 'replaceSelection' | 'costs'
> & {
  random?: () => number;
};

const useUnfilledMessage = () => {
  const t = useTranslations('builder');
  const cap = triumphRules.pointsCap;
  return (fill: Exclude<ArmyFill, { kind: 'filled' }>) =>
    fill.reason === 'noGeneralStand'
      ? t('randomizeNoGeneral')
      : t('randomizeUnreachable', { closest: fill.closest, cap });
};

export const useRandomizeList = ({
  dataVersion,
  armyList,
  selection,
  replaceSelection,
  costs,
  random = Math.random,
}: RandomizeListInput) => {
  const t = useTranslations('builder');
  const unfilledMessage = useUnfilledMessage();

  return () => {
    const fill = randomFill(
      armyList,
      startBuilding(armyList, dataVersion, selection),
      costs,
      random,
    );
    if (fill.kind !== 'filled') {
      toast.error(unfilledMessage(fill));
      return;
    }
    const previous = selection;
    replaceSelection(fill.selection);
    toast.success(t('randomized', { cap: triumphRules.pointsCap }), {
      action: { label: t('undo'), onClick: () => replaceSelection(previous) },
    });
  };
};
