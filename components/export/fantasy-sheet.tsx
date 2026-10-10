import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import {
  SheetBadge,
  SheetFact,
  SheetFooter,
  SheetMasthead,
  SheetRunningHeader,
  sheetStyles as styles,
} from '@/components/export/sheet-parts';
import type {
  FantasySheet,
  FantasySheetArmyLine,
  FantasySheetHero,
  FantasySheetUnit,
} from '@/lib/domain/fantasy/sheet-data';
import { heroLabel } from '@/lib/domain/fantasy/text-export';
import { fantasyGameName } from '@/lib/domain/games/fantasy';
import {
  armyLineName,
  armyLinePoints,
  cardsText,
  factorCell,
  fantasyFactorColumns,
  fantasyFacts,
  fantasyHeadline,
  fantasySheetWords,
  fantasyTotalText,
  generalUnit,
  topographyText,
  unitMarks,
} from '@/lib/export/fantasy-sheet-layout';
import { formatPoints, formatPointsWithUnit } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locales';
import { type Words, wordsFor } from '@/lib/i18n/translator';
import { gameBuilderUrl } from '@/lib/navigation';

const { numeric } = StyleSheet.create({
  numeric: { width: 52, textAlign: 'right', paddingRight: 6 },
});

function ColumnLabels({
  labels,
  factorLabels,
}: {
  labels: readonly [string, ...string[]];
  factorLabels: readonly string[];
}) {
  const [first, ...figures] = labels;
  return (
    <View style={styles.columns}>
      <Text style={[styles.cardName, styles.columnLabel]}>{first}</Text>
      {figures.map((label) => (
        <Text key={label} style={[numeric, styles.columnLabel]}>
          {label}
        </Text>
      ))}
      {factorLabels.map((label) => (
        <Text key={label} style={[styles.factor, styles.columnLabel]}>
          {label}
        </Text>
      ))}
    </View>
  );
}

function Details({ lines }: { lines: readonly string[] }) {
  return lines.map((line) => (
    <Text key={line} style={styles.troopDescription}>
      {line}
    </Text>
  ));
}

function UnitRow({
  unit,
  w,
  locale,
}: {
  unit: FantasySheetUnit;
  w: Words;
  locale: Locale;
}) {
  return (
    <View style={styles.cardRow} wrap={false}>
      <View style={styles.cardName}>
        <View style={styles.troopTypeName}>
          <Text style={unit.general ? styles.generalTroopType : {}}>
            {unit.name}
          </Text>
          {unit.general ? <SheetBadge label={w('general')} filled /> : null}
        </View>
        <Details
          lines={[
            unit.troopTypeName,
            ...(unit.cards.length > 0 ? [cardsText(unit.cards)] : []),
            ...unitMarks(unit, w, locale),
          ]}
        />
      </View>
      <Text style={numeric}>{unit.stands}</Text>
      <Text style={numeric}>{formatPoints(unit.pointsPerStand)}</Text>
      <Text style={numeric}>{formatPoints(unit.points)}</Text>
      {fantasyFactorColumns.map((column) => (
        <Text key={column.key} style={styles.factor}>
          {factorCell(column, unit)}
        </Text>
      ))}
    </View>
  );
}

function HeroRow({
  hero,
  index,
  w,
}: {
  hero: FantasySheetHero;
  index: number;
  w: Words;
}) {
  return (
    <View style={styles.cardRow} wrap={false}>
      <View style={styles.cardName}>
        <Text>{heroLabel(hero, index, w('hero'))}</Text>
        <Details
          lines={[
            ...(hero.cards.length > 0 ? [cardsText(hero.cards)] : []),
            ...(hero.delayedEntry ? [w('delayedEntry')] : []),
          ]}
        />
      </View>
      <Text style={numeric}>{formatPoints(hero.points)}</Text>
    </View>
  );
}

function ArmyCardRow({ line }: { line: FantasySheetArmyLine }) {
  return (
    <View style={styles.cardRow} wrap={false}>
      <View style={styles.cardName}>
        <Text>{armyLineName(line)}</Text>
        {line.bearer ? (
          <Text style={styles.cardAttached}>{line.bearer}</Text>
        ) : null}
      </View>
      <Text style={numeric}>{armyLinePoints(line)}</Text>
    </View>
  );
}

function SheetSection<Row>({
  title,
  rows,
  empty,
  labels,
  factorLabels = [],
  children,
}: {
  title: string;
  rows: readonly Row[];
  empty: string;
  labels: readonly [string, ...string[]];
  factorLabels?: readonly string[];
  children: (row: Row, index: number) => ReactNode;
}) {
  return (
    <View style={styles.contingent}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        <>
          <ColumnLabels labels={labels} factorLabels={factorLabels} />
          {rows.map(children)}
        </>
      )}
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cardRow} wrap={false}>
      <Text style={[styles.cardName, styles.generalTroopType]}>{label}</Text>
      <Text style={styles.generalTroopType}>{value}</Text>
    </View>
  );
}

export function FantasySheetDocument({
  sheet,
  generatedAt,
  siteUrl,
  locale,
  shareUrl = null,
}: {
  sheet: FantasySheet;
  generatedAt: Date;
  siteUrl: string;
  locale: Locale;
  shareUrl?: string | null;
}) {
  const w = fantasySheetWords(locale);
  const footerWords = wordsFor(locale, 'sheet');
  const generated = generatedAt.toISOString().slice(0, 10);
  return (
    <Document
      title={sheet.listName}
      author="Triumph! Army Builder"
      subject={fantasyGameName}
    >
      <Page size="A4" style={styles.page}>
        <SheetRunningHeader
          title={sheet.listName}
          points={`${formatPoints(sheet.totals.total)} points`}
        />

        <SheetMasthead
          title={sheet.listName}
          subtitle={`${fantasyGameName} · ${topographyText(sheet, w)}`}
          headline={fantasyHeadline(sheet, locale)}
          shareUrl={shareUrl}
        />

        <View style={styles.facts}>
          {fantasyFacts(sheet, w, locale).map(({ key, label, value }) => (
            <SheetFact key={key} label={label} value={value} />
          ))}
        </View>

        <SheetSection
          title={w('units')}
          rows={sheet.units}
          empty={w('noUnits')}
          labels={[w('unit'), w('stands'), w('pointsPerStand'), w('points')]}
          factorLabels={fantasyFactorColumns.map(({ key }) => w(key))}
        >
          {(unit) => (
            <UnitRow key={unit.id} unit={unit} w={w} locale={locale} />
          )}
        </SheetSection>

        <SheetSection
          title={w('heroes')}
          rows={sheet.heroes}
          empty={w('noHeroes')}
          labels={[w('hero'), w('points')]}
        >
          {(hero, index) => (
            <HeroRow key={hero.id} hero={hero} index={index} w={w} />
          )}
        </SheetSection>

        <SheetSection
          title={w('armyCards')}
          rows={sheet.armyCards}
          empty={w('noArmyCards')}
          labels={[w('card'), w('points')]}
        >
          {(line) => (
            <ArmyCardRow
              key={`${line.kind}-${line.code}-${line.bearer ?? ''}`}
              line={line}
            />
          )}
        </SheetSection>

        <View style={styles.contingent} wrap={false}>
          <TotalRow
            label={w('victoryValue')}
            value={formatPointsWithUnit(sheet.totals.victoryValue, locale)}
          />
          <TotalRow
            label={w('total')}
            value={fantasyTotalText(sheet, locale)}
          />
        </View>

        <SheetFooter
          w={footerWords}
          generalKey={generalUnit(sheet) !== null}
          listUrl={`${siteUrl}${gameBuilderUrl('fantasy')}`}
          dataLine={w('dataVersion', { version: sheet.dataVersion, generated })}
        />
      </Page>
    </Document>
  );
}
