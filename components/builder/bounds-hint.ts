import type { Bounds } from '@/lib/domain/army/bounds';
import type { Locale } from '@/lib/i18n/locales';
import { wordsFor } from '@/lib/i18n/translator';

export const boundsHint = (
  bounds: Bounds,
  count: number,
  min: number | null,
  max: number | null,
  locale: Locale,
) => {
  const w = wordsFor(locale, 'builder');
  if (bounds === 'belowMin' && min !== null) {
    return w('moreToMinimum', { count: min - count });
  }
  return bounds === 'aboveMax' && max !== null
    ? w('overMaximum', { count: count - max })
    : null;
};
