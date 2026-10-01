import { useTranslations } from 'next-intl';
import {
  baseWidths,
  type StandFigures,
  type TroopTypeBasing,
} from '@/lib/domain/troop-types';

export const unknownValue = '—';

export function BaseSizesLabel({ basing }: { basing: TroopTypeBasing | null }) {
  return basing
    ? baseWidths.map((width) => `${width}×${basing.depths[width]}`).join(' · ')
    : unknownValue;
}

export function StandFiguresLabel({
  figures,
}: {
  figures: StandFigures | null;
}) {
  const t = useTranslations('builder');
  if (figures === null) {
    return unknownValue;
  }
  if (figures.kind === 'modelWithCrew') {
    return t('modelWithCrew');
  }
  return figures.min === figures.max
    ? t('figuresPerStand', { count: figures.min })
    : t('figureRangePerStand', { min: figures.min, max: figures.max });
}
