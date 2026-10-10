import { Image, Link, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { SheetQr } from '@/components/export/sheet-qr';
import {
  sheetColors,
  sheetFontFamily,
  sheetMarkFile,
} from '@/lib/export/pdf-theme';
import type { Words } from '@/lib/i18n/translator';
import { externalLinks } from '@/lib/navigation';

export const sheetStyles = StyleSheet.create({
  page: {
    fontFamily: sheetFontFamily,
    fontSize: 9,
    color: sheetColors.foreground,
    backgroundColor: sheetColors.background,
    paddingTop: 34,
    paddingBottom: 76,
    paddingHorizontal: 34,
  },
  runningHeader: {
    position: 'absolute',
    top: 14,
    left: 34,
    right: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: sheetColors.mutedForeground,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 34,
    right: 34,
    borderTopWidth: 0.5,
    borderTopColor: sheetColors.border,
    paddingTop: 5,
    fontSize: 7,
    color: sheetColors.mutedForeground,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2.5,
  },
  footerLine: { marginBottom: 1.5 },
  footerKeyMark: { color: sheetColors.foreground, fontWeight: 600 },
  footerLink: { color: sheetColors.mutedForeground, textDecoration: 'none' },
  masthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mark: { width: 30, height: 30, marginRight: 9 },
  heading: { flex: 1, paddingRight: 16 },
  title: { fontSize: 18, fontWeight: 600, letterSpacing: -0.3 },
  subtitle: { fontSize: 9, color: sheetColors.mutedForeground, marginTop: 2 },
  headline: { fontSize: 10, fontWeight: 600, marginTop: 4 },
  shareBlock: { alignItems: 'center', width: 96 },
  shareUrl: {
    fontSize: 8,
    color: sheetColors.mutedForeground,
    textDecoration: 'none',
    marginTop: 3,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: sheetColors.border,
    paddingTop: 8,
    marginBottom: 10,
  },
  fact: { width: '25%', paddingRight: 10, marginBottom: 7 },
  factLabel: {
    fontSize: 7,
    color: sheetColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  factValue: { fontSize: 8.5, marginTop: 1.5 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 5,
  },
  contingent: { marginBottom: 12 },
  contingentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: sheetColors.primary,
    paddingBottom: 3,
    marginBottom: 4,
  },
  contingentName: { fontSize: 10.5, fontWeight: 600 },
  contingentMeta: { fontSize: 8, color: sheetColors.mutedForeground },
  columns: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: sheetColors.border,
    paddingBottom: 2,
    marginBottom: 2,
  },
  columnLabel: {
    fontSize: 6.5,
    color: sheetColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: sheetColors.border,
  },
  troopType: { flex: 1, paddingRight: 6 },
  numeric: { width: 34, textAlign: 'right', paddingRight: 6 },
  factor: { width: 34, textAlign: 'right', paddingRight: 4 },
  troopTypeName: { flexDirection: 'row', alignItems: 'center' },
  troopDescription: {
    fontSize: 7.5,
    color: sheetColors.mutedForeground,
    marginTop: 1.5,
  },
  badge: {
    fontSize: 6.5,
    borderWidth: 0.5,
    borderColor: sheetColors.border,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  filledBadge: {
    backgroundColor: sheetColors.muted,
    borderColor: sheetColors.muted,
  },
  generalTroopType: { fontWeight: 600 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: sheetColors.border,
  },
  cardName: { flex: 1, paddingRight: 6, fontSize: 8.5 },
  cardAttached: {
    fontSize: 7.5,
    color: sheetColors.mutedForeground,
    marginTop: 1,
  },
  empty: { fontSize: 8.5, color: sheetColors.mutedForeground },
});

export function SheetFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export function SheetBadge({
  label,
  filled,
}: {
  label: string;
  filled: boolean;
}) {
  return (
    <View style={[styles.badge, filled ? styles.filledBadge : {}]}>
      <Text>{label}</Text>
    </View>
  );
}

const shareQrSize = 68;

const styles = sheetStyles;

export function SheetRunningHeader({
  title,
  points,
}: {
  title: string;
  points: string;
}) {
  return (
    <View
      style={styles.runningHeader}
      fixed
      render={({ pageNumber }) =>
        pageNumber > 1 ? (
          <>
            <Text>{title}</Text>
            <Text>{points}</Text>
          </>
        ) : null
      }
    />
  );
}

export function SheetMasthead({
  title,
  subtitle,
  headline,
  shareUrl,
}: {
  title: string;
  subtitle: string;
  headline: string;
  shareUrl: string | null;
}) {
  return (
    <View style={styles.masthead}>
      <Image src={sheetMarkFile} style={styles.mark} />
      <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.headline}>{headline}</Text>
        {shareUrl ? (
          <Link src={shareUrl} style={styles.shareUrl}>
            {shareUrl}
          </Link>
        ) : null}
      </View>
      {shareUrl ? (
        <View style={styles.shareBlock}>
          <SheetQr url={shareUrl} size={shareQrSize} />
        </View>
      ) : null}
    </View>
  );
}

export function SheetFooter({
  w,
  generalKey,
  listUrl,
  dataLine,
}: {
  w: Words;
  generalKey: boolean;
  listUrl: string;
  dataLine: string;
}) {
  return (
    <View style={styles.footer} fixed>
      {generalKey ? (
        <Text style={styles.footerLine}>
          {`${w('key')} `}
          <Text style={styles.footerKeyMark}>{w('general')}</Text>
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        <Link src={listUrl} style={styles.footerLink}>
          {listUrl}
        </Link>
        <Text
          render={({ pageNumber, totalPages }) =>
            w('pageOf', { page: pageNumber, total: totalPages })
          }
        />
      </View>
      <Text style={styles.footerLine}>
        {w.rich('unofficial', {
          triumph: (chunks: ReactNode) => (
            <Link src={externalLinks.triumph} style={styles.footerLink}>
              {chunks}
            </Link>
          ),
        })}
      </Text>
      <Text>{dataLine}</Text>
    </View>
  );
}
