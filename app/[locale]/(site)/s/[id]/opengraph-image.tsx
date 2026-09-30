import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getLocale, getTranslations } from 'next-intl/server';
import { servedReference } from '@/lib/data/served-bundle';
import { getDatabase } from '@/lib/db/client';
import { triumphRules } from '@/lib/domain/army/validation';
import { formatPoints, formatYear } from '@/lib/format';
import type { IdRouteProps } from '@/lib/navigation';
import { loadSharedView } from '@/lib/share/shared-view';

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

export const alt = 'A Triumph! army list';

const cardColors = {
  background: '#1c1917',
  foreground: '#fafaf9',
  muted: '#a8a29e',
  panel: '#292524',
  legal: '#86efac',
  illegal: '#fca5a5',
};

const siteName = 'Triumph! Army Builder';

const readFont = (weight: 'Regular' | 'SemiBold') =>
  readFile(join(process.cwd(), 'public', 'fonts', `IBMPlexSans-${weight}.ttf`));

const titleSize = (name: string) => (name.length > 36 ? 60 : 76);

function Stat({
  value,
  label,
  colour = cardColors.foreground,
}: {
  value: string;
  label: string;
  colour?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: cardColors.panel,
        borderRadius: 16,
        padding: '20px 32px',
      }}
    >
      <span style={{ fontSize: 56, fontWeight: 600, color: colour }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 22,
          color: cardColors.muted,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Card({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle: string;
  stats: readonly { value: string; label: string; colour?: string }[];
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: 72,
        backgroundColor: cardColors.background,
        color: cardColors.foreground,
        fontFamily: 'IBM Plex Sans',
      }}
    >
      <span
        style={{
          fontSize: 24,
          color: cardColors.muted,
          textTransform: 'uppercase',
          letterSpacing: 6,
        }}
      >
        {siteName}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span
          style={{
            fontSize: titleSize(title),
            fontWeight: 600,
            lineHeight: 1.1,
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 32, color: cardColors.muted }}>
          {subtitle}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}

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
  const [regular, semiBold] = await Promise.all([
    readFont('Regular'),
    readFont('SemiBold'),
  ]);

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
            label: t('ogArmyOf', { cap: triumphRules.pointsCap }),
            colour: view.report.legal ? cardColors.legal : cardColors.illegal,
          },
        ],
      }
    : {
        title: t('ogGone'),
        subtitle: t('ogGoneSubtitle'),
        stats: [],
      };

  return new ImageResponse(<Card {...card} />, {
    ...size,
    fonts: [
      { name: 'IBM Plex Sans', data: regular, weight: 400, style: 'normal' },
      { name: 'IBM Plex Sans', data: semiBold, weight: 600, style: 'normal' },
    ],
  });
}
