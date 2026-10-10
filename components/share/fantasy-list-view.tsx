import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { PointsMeterBar } from '@/components/builder/points-meter';
import { Fact } from '@/components/fact';
import {
  FantasyListFindingsBadge,
  FantasyListFindingsPanel,
} from '@/components/fantasy/fantasy-list-findings';
import { Section } from '@/components/layout/section';
import {
  StackedTable,
  StackedTableField,
  StackedTableRow,
} from '@/components/stacked-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { FantasyReading } from '@/lib/domain/army/shared-view';
import type {
  FantasySheetArmyLine,
  FantasySheetHero,
  FantasySheetUnit,
} from '@/lib/domain/fantasy/sheet-data';
import { heroLabel } from '@/lib/domain/fantasy/text-export';
import {
  armyLineName,
  armyLinePoints,
  cardsText,
  fantasyFacts,
  fantasySheetWords,
  unitMarks,
} from '@/lib/export/fantasy-sheet-layout';
import { formatPoints } from '@/lib/format';

const unitColumns =
  'grid gap-x-4 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(10rem,2fr)_4.5rem_4.5rem_4.5rem]';

const pointsColumns =
  'grid gap-x-4 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(10rem,2fr)_4.5rem]';

const useFantasySheetWords = () => fantasySheetWords(useLocale());

function Details({ lines }: { lines: readonly string[] }) {
  return lines.map((line) => (
    <span key={line} className="block text-xs text-muted-foreground">
      {line}
    </span>
  ));
}

function UnitRow({ unit }: { unit: FantasySheetUnit }) {
  const w = useFantasySheetWords();
  const locale = useLocale();
  return (
    <StackedTableRow>
      <dl className={unitColumns}>
        <StackedTableField label={w('unit')}>
          <span className="flex flex-wrap items-center gap-2">
            <span className={unit.general ? 'font-semibold' : 'font-medium'}>
              {unit.name}
            </span>
            {unit.general && <Badge variant="secondary">{w('general')}</Badge>}
          </span>
          <Details
            lines={[
              unit.troopTypeName,
              ...(unit.cards.length > 0 ? [cardsText(unit.cards)] : []),
              ...unitMarks(unit, w, locale),
            ]}
          />
        </StackedTableField>
        <StackedTableField label={w('stands')}>
          <span className="tabular-nums">{unit.stands}</span>
        </StackedTableField>
        <StackedTableField label={w('pointsPerStand')}>
          <span className="tabular-nums">
            {formatPoints(unit.pointsPerStand)}
          </span>
        </StackedTableField>
        <StackedTableField label={w('points')}>
          <span className="tabular-nums">{formatPoints(unit.points)}</span>
        </StackedTableField>
      </dl>
    </StackedTableRow>
  );
}

function PointsRow({
  label,
  name,
  details,
  points,
}: {
  label: string;
  name: string;
  details: readonly string[];
  points: string;
}) {
  const w = useFantasySheetWords();
  return (
    <StackedTableRow>
      <dl className={pointsColumns}>
        <StackedTableField label={label}>
          <span className="font-medium">{name}</span>
          <Details lines={details} />
        </StackedTableField>
        <StackedTableField label={w('points')}>
          <span className="tabular-nums">{points}</span>
        </StackedTableField>
      </dl>
    </StackedTableRow>
  );
}

function HeroRow({ hero, index }: { hero: FantasySheetHero; index: number }) {
  const w = useFantasySheetWords();
  return (
    <PointsRow
      label={w('hero')}
      name={heroLabel(hero, index, w('hero'))}
      details={[
        ...(hero.cards.length > 0 ? [cardsText(hero.cards)] : []),
        ...(hero.delayedEntry ? [w('delayedEntry')] : []),
      ]}
      points={formatPoints(hero.points)}
    />
  );
}

function ArmyCardRow({ line }: { line: FantasySheetArmyLine }) {
  const w = useFantasySheetWords();
  return (
    <PointsRow
      label={w('card')}
      name={armyLineName(line)}
      details={line.bearer ? [line.bearer] : []}
      points={armyLinePoints(line)}
    />
  );
}

function SheetSection<Row>({
  title,
  rows,
  empty,
  columns,
  headings,
  children,
}: {
  title: string;
  rows: readonly Row[];
  empty: string;
  columns: string;
  headings: readonly string[];
  children: (row: Row, index: number) => ReactNode;
}) {
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <StackedTable columns={columns} headings={headings}>
          {rows.map(children)}
        </StackedTable>
      )}
    </Section>
  );
}

export function FantasyListView({
  reading,
  notice,
}: {
  reading: FantasyReading;
  notice: ReactNode;
}) {
  const locale = useLocale();
  const w = useFantasySheetWords();
  const t = useTranslations('fantasyBuilder');
  const { sheet, meter } = reading;
  return (
    <>
      <PointsMeterBar
        meter={meter}
        subtotals={t('subtotals', {
          victory: formatPoints(sheet.totals.victoryValue),
          army: formatPoints(sheet.totals.total - sheet.totals.victoryValue),
        })}
        trailing={
          <FantasyListFindingsBadge
            report={reading.report}
            sheet={sheet}
            cardNames={reading.cardNames}
          />
        }
      />

      {notice}

      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fantasyFacts(sheet, w, locale).map(({ key, label, value }) => (
              <Fact key={key} label={label}>
                {value}
              </Fact>
            ))}
          </dl>
        </CardContent>
      </Card>

      <SheetSection
        title={w('units')}
        rows={sheet.units}
        empty={w('noUnits')}
        columns={unitColumns}
        headings={[w('unit'), w('stands'), w('pointsPerStand'), w('points')]}
      >
        {(unit) => <UnitRow key={unit.id} unit={unit} />}
      </SheetSection>

      <SheetSection
        title={w('heroes')}
        rows={sheet.heroes}
        empty={w('noHeroes')}
        columns={pointsColumns}
        headings={[w('hero'), w('points')]}
      >
        {(hero, index) => <HeroRow key={hero.id} hero={hero} index={index} />}
      </SheetSection>

      <SheetSection
        title={w('armyCards')}
        rows={sheet.armyCards}
        empty={w('noArmyCards')}
        columns={pointsColumns}
        headings={[w('card'), w('points')]}
      >
        {(line) => (
          <ArmyCardRow
            key={`${line.kind}-${line.code}-${line.bearer ?? ''}`}
            line={line}
          />
        )}
      </SheetSection>

      <FantasyListFindingsPanel
        report={reading.report}
        sheet={sheet}
        cardNames={reading.cardNames}
      />
    </>
  );
}
