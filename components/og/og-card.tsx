import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { ComponentProps } from 'react';
import { siteName } from '@/lib/brand';

export const ogSize = { width: 1200, height: 630 };

export const ogContentType = 'image/png';

export const ogCardColors = {
  background: '#1c1917',
  foreground: '#fafaf9',
  muted: '#a8a29e',
  panel: '#292524',
  legal: '#86efac',
  illegal: '#fca5a5',
};

const readFont = (weight: 'Regular' | 'SemiBold') =>
  readFile(join(process.cwd(), 'public', 'fonts', `IBMPlexSans-${weight}.ttf`));

const titleSize = (name: string) => (name.length > 36 ? 60 : 76);

function OgStat({
  value,
  label,
  colour = ogCardColors.foreground,
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
        backgroundColor: ogCardColors.panel,
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
          color: ogCardColors.muted,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function OgCard({
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
        backgroundColor: ogCardColors.background,
        color: ogCardColors.foreground,
        fontFamily: 'IBM Plex Sans',
      }}
    >
      <span
        style={{
          fontSize: 24,
          color: ogCardColors.muted,
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
        <span style={{ fontSize: 32, color: ogCardColors.muted }}>
          {subtitle}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {stats.map((stat) => (
          <OgStat key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}

export const ogCardImage = async (card: ComponentProps<typeof OgCard>) => {
  const [regular, semiBold] = await Promise.all([
    readFont('Regular'),
    readFont('SemiBold'),
  ]);
  return new ImageResponse(<OgCard {...card} />, {
    ...ogSize,
    fonts: [
      { name: 'IBM Plex Sans', data: regular, weight: 400, style: 'normal' },
      { name: 'IBM Plex Sans', data: semiBold, weight: 600, style: 'normal' },
    ],
  });
};
