import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { SheetQr } from '@/components/export/sheet-qr';
import {
  type ArmySheet,
  type SheetBattleCard,
  type SheetContingent,
  type SheetTroopOption,
  sheetCardHeadings,
  sheetStandColumns,
  sheetTroopHeadings,
} from '@/lib/domain/army/sheet';
import {
  sheetColors,
  sheetFontFamily,
  sheetMarkFile,
} from '@/lib/export/pdf-theme';
import {
  battleLineLabels,
  cardStandsCell,
  describeContingent,
  sheetFacts,
  standCell,
} from '@/lib/export/sheet-layout';
import {
  formatPoints,
  formatPointsWithUnit,
  formatStandCount,
  formatStands,
  formatYearSpan,
} from '@/lib/format';
import type { Locale } from '@/lib/i18n/locales';
import { type Words, wordsFor } from '@/lib/i18n/translator';
import { armyUrl, externalLinks } from '@/lib/navigation';

const styles = StyleSheet.create({
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function SheetBadge({ label, filled }: { label: string; filled: boolean }) {
  return (
    <View style={[styles.badge, filled ? styles.filledBadge : {}]}>
      <Text>{label}</Text>
    </View>
  );
}

function TroopOptionBlock({
  option,
  w,
}: {
  option: SheetTroopOption;
  w: Words;
}) {
  const battleLine = battleLineLabels[option.battleLine];
  const description = [option.description, option.note]
    .filter(Boolean)
    .join(' · ');
  return (
    <View wrap={false}>
      {option.lines.map((line) => (
        <View key={line.troopType} style={styles.row}>
          <View style={styles.troopType}>
            <View style={styles.troopTypeName}>
              <Text style={line.general ? styles.generalTroopType : {}}>
                {formatStandCount(line.stands, line.name)}
              </Text>
              {line.general ? <SheetBadge label={w('general')} filled /> : null}
              {battleLine ? (
                <SheetBadge label={w(battleLine)} filled={false} />
              ) : null}
            </View>
            {description ? (
              <Text style={styles.troopDescription}>{description}</Text>
            ) : null}
          </View>
          {sheetStandColumns.map((column) => (
            <Text
              key={column.key}
              style={column.kind === 'points' ? styles.numeric : styles.factor}
            >
              {standCell(column, line)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const troopHeadingStyle = (index: number) => {
  if (index === 0) {
    return styles.troopType;
  }
  return sheetStandColumns[index - 1]?.kind === 'points'
    ? styles.numeric
    : styles.factor;
};

function ContingentBlock({
  contingent,
  w,
  locale,
}: {
  contingent: SheetContingent;
  w: Words;
  locale: Locale;
}) {
  return (
    <View style={styles.contingent}>
      <View style={styles.contingentHead}>
        <Text style={styles.contingentName}>{contingent.name}</Text>
        <Text style={styles.contingentMeta}>
          {describeContingent(contingent, w, locale)}
        </Text>
      </View>
      <View style={styles.columns}>
        {sheetTroopHeadings.map((key, index) => (
          <Text
            key={key}
            style={[troopHeadingStyle(index), styles.columnLabel]}
          >
            {w(key)}
          </Text>
        ))}
      </View>
      {contingent.options.map((option) => (
        <TroopOptionBlock w={w} key={option.id} option={option} />
      ))}
    </View>
  );
}

function BattleCardRow({ card }: { card: SheetBattleCard }) {
  return (
    <View style={styles.cardRow} wrap={false}>
      <View style={styles.cardName}>
        <Text>{card.name}</Text>
        {card.attachedTo.length > 0 ? (
          <Text style={styles.cardAttached}>{card.attachedTo.join(' · ')}</Text>
        ) : null}
      </View>
      <Text style={styles.numeric}>{card.purchases}</Text>
      <Text style={styles.numeric}>{cardStandsCell(card)}</Text>
      <Text style={styles.numeric}>{formatPoints(card.points)}</Text>
    </View>
  );
}

const shareQrSize = 68;

export function ArmySheetDocument({
  sheet,
  generatedAt,
  siteUrl,
  locale,
  shareUrl = null,
}: {
  sheet: ArmySheet;
  generatedAt: Date;
  siteUrl: string;
  locale: Locale;
  shareUrl?: string | null;
}) {
  const w = wordsFor(locale, 'sheet');
  const generated = generatedAt.toISOString().slice(0, 10);
  const listUrl = `${siteUrl}${armyUrl(sheet.armyId)}`;
  return (
    <Document
      title={sheet.listName}
      author="Triumph! Army Builder"
      subject={sheet.armyName}
    >
      <Page size="A4" style={styles.page}>
        <View
          style={styles.runningHeader}
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <>
                <Text>{sheet.listName}</Text>
                <Text>{`${formatPoints(sheet.totals.total)} points`}</Text>
              </>
            ) : null
          }
        />

        <View style={styles.masthead}>
          <Image src={sheetMarkFile} style={styles.mark} />
          <View style={styles.heading}>
            <Text style={styles.title}>{sheet.listName}</Text>
            <Text style={styles.subtitle}>
              {`${sheet.armyName} · List ${sheet.key} · ${formatYearSpan(sheet.dateRange, locale)}`}
            </Text>
            <Text style={styles.headline}>
              {`${formatPointsWithUnit(sheet.totals.total, locale)} · ${formatStands(sheet.totals.stands, locale)}`}
            </Text>
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

        <View style={styles.facts}>
          {sheetFacts(sheet, w, locale).map(({ key, label, value }) => (
            <Fact key={key} label={label} value={value} />
          ))}
        </View>

        {sheet.contingents.length === 0 ? (
          <Text style={styles.empty}>{w('emptyList')}</Text>
        ) : (
          sheet.contingents.map((contingent) => (
            <ContingentBlock
              w={w}
              locale={locale}
              key={contingent.id}
              contingent={contingent}
            />
          ))
        )}

        <View style={styles.contingent}>
          <Text style={styles.sectionTitle}>{w('battleCards')}</Text>
          {sheet.battleCards.length === 0 ? (
            <Text style={styles.empty}>{w('noBattleCards')}</Text>
          ) : (
            <>
              <View style={styles.columns}>
                {sheetCardHeadings.map((key, index) => (
                  <Text
                    key={key}
                    style={[
                      index === 0 ? styles.cardName : styles.numeric,
                      styles.columnLabel,
                    ]}
                  >
                    {w(key)}
                  </Text>
                ))}
              </View>
              {sheet.battleCards.map((card) => (
                <BattleCardRow key={card.code} card={card} />
              ))}
            </>
          )}
        </View>

        <View style={styles.footer} fixed>
          {sheet.general ? (
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
          <Text>
            {w('dataVersion', { version: sheet.dataVersion, generated })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
