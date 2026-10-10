'use client';

import { useTranslations } from 'next-intl';
import { formatPoints } from '@/lib/format';

export const signedPoints = (points: number) =>
  points > 0 ? `+${formatPoints(points)}` : formatPoints(points);

export const usePointsWords = () => {
  const t = useTranslations('fantasyBuilder');
  return {
    perStand: (points: number | null) =>
      points === null
        ? t('costByChoice')
        : t('costPerStand', { points: signedPoints(points) }),
    each: (points: number | null) =>
      points === null
        ? t('costByChoice')
        : t('costPoints', { points: signedPoints(points) }),
    rating: (points: number) => {
      if (points === 0) {
        return t('ratingFree');
      }
      return points > 0
        ? t('ratingCosts', { points: formatPoints(points) })
        : t('ratingRefunds', { points: formatPoints(-points) });
    },
  };
};
