import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  SheetBadge,
  SheetFact,
  SheetFooter,
  SheetMasthead,
  SheetRunningHeader,
  sheetStyles,
} from '@/components/export/sheet-parts';
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
import { armyUrl } from '@/lib/navigation';

const styles = sheetStyles;

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
        <SheetRunningHeader
          title={sheet.listName}
          points={`${formatPoints(sheet.totals.total)} points`}
        />

        <SheetMasthead
          title={sheet.listName}
          subtitle={`${sheet.armyName} · List ${sheet.key} · ${formatYearSpan(sheet.dateRange, locale)}`}
          headline={`${formatPointsWithUnit(sheet.totals.total, locale)} · ${formatStands(sheet.totals.stands, locale)}`}
          shareUrl={shareUrl}
        />

        <View style={styles.facts}>
          {sheetFacts(sheet, w, locale).map(({ key, label, value }) => (
            <SheetFact key={key} label={label} value={value} />
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

        <SheetFooter
          w={w}
          generalKey={sheet.general !== null}
          listUrl={listUrl}
          dataLine={w('dataVersion', { version: sheet.dataVersion, generated })}
        />
      </Page>
    </Document>
  );
}
