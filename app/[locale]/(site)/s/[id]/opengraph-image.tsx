import { getLocale, getTranslations } from 'next-intl/server';
import {
  ogCardColors,
  ogCardImage,
  ogContentType,
  ogSize,
} from '@/components/og/og-card';
import { servedReference } from '@/lib/data/served-bundle';
import { getDatabase } from '@/lib/db/client';
import { formatPoints, formatYear } from '@/lib/format';
import type { IdRouteProps } from '@/lib/navigation';
import { loadSharedView } from '@/lib/share/shared-view';

export const size = ogSize;

export const contentType = ogContentType;

export const alt = 'A Triumph! army list';

export default async function SharedListImage({ params }: IdRouteProps) {
  const locale = await getLocale();
  const t = await getTranslations('pages');
  const reference = await servedReference(locale);
  const view =
    reference &&
    (await loadSharedView({
      db: getDatabase(),
      bundle: reference.bundle,
      id: (await params).id,
    }));
  const card = view
    ? {
        title: view.list.name,
        subtitle: [
          view.sheet.armyName,
          formatYear(view.sheet.year, locale),
          view.sheet.subFaction?.name,
        ]
          .filter((part) => !!part)
          .join(' · '),
        stats: [
          {
            value: formatPoints(view.sheet.totals.total),
            label: t('ogPoints'),
          },
          { value: `${view.sheet.totals.stands}`, label: t('ogStands') },
          {
            value: view.report.legal ? t('ogLegal') : t('ogIllegal'),
            label: t('ogArmyOf', { cap: view.meter.cap }),
            colour: view.report.legal
              ? ogCardColors.legal
              : ogCardColors.illegal,
          },
        ],
      }
    : {
        title: t('ogGone'),
        subtitle: t('ogGoneSubtitle'),
        stats: [],
      };

  return ogCardImage(card);
}
