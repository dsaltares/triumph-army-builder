import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BadgeRow } from '@/components/badge-row';
import { PointsMeterBar } from '@/components/builder/points-meter';
import {
  LegalityBadge,
  ValidationPanel,
} from '@/components/builder/validation-panel';
import { DataVersionNotice } from '@/components/data-version-notice';
import { Fact } from '@/components/fact';
import {
  FrozenTable,
  FrozenTableCell,
  FrozenTableGroup,
  FrozenTableRow,
  FrozenTableRowHeading,
} from '@/components/frozen-table';
import { Section } from '@/components/layout/section';
import {
  StackedTable,
  StackedTableField,
  StackedTableRow,
} from '@/components/stacked-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { encodeShareCode } from '@/lib/domain/army/share-codec';
import type {
  ListView,
  SavedView,
  SharedView,
} from '@/lib/domain/army/shared-view';
import {
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
import { formatDate, formatPoints, formatStandCount } from '@/lib/format';
import { wordsFor } from '@/lib/i18n/translator';
import { buildArmyUrl, listSheetUrl, savedListUrl } from '@/lib/navigation';

const cardColumns =
  'grid gap-x-4 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(10rem,2fr)_4.5rem_4.5rem_4.5rem]';

const noAnchors: ReadonlySet<string> = new Set();

const linkClass = 'font-medium underline underline-offset-4';

const useSheetWords = () => wordsFor(useLocale(), 'sheet');

function TroopOptionRows({ option }: { option: SheetTroopOption }) {
  const w = useSheetWords();
  const battleLine = battleLineLabels[option.battleLine];
  return (
    <FrozenTableGroup>
      {option.lines.map((line, index) => (
        <FrozenTableRow key={line.troopType}>
          <FrozenTableRowHeading>
            <div className="flex flex-wrap items-center gap-2">
              <span className={line.general ? 'font-semibold' : 'font-medium'}>
                {formatStandCount(line.stands, line.name)}
              </span>
              {line.general && (
                <Badge variant="secondary">{w('general')}</Badge>
              )}
              {battleLine && <Badge variant="outline">{w(battleLine)}</Badge>}
            </div>
            {index === 0 && (option.description || option.note) && (
              <div className="mt-1">
                {option.description && (
                  <p className="text-xs text-pretty text-muted-foreground">
                    {option.description}
                  </p>
                )}
                <BadgeRow className="mt-1" labels={[option.note]} />
              </div>
            )}
          </FrozenTableRowHeading>
          {sheetStandColumns.map((column) => (
            <FrozenTableCell key={column.key}>
              {standCell(column, line)}
            </FrozenTableCell>
          ))}
        </FrozenTableRow>
      ))}
    </FrozenTableGroup>
  );
}

function ContingentSection({ contingent }: { contingent: SheetContingent }) {
  const w = useSheetWords();
  const locale = useLocale();
  return (
    <Section
      title={contingent.name}
      description={describeContingent(contingent, w, locale)}
    >
      <FrozenTable
        label={contingent.name}
        headings={sheetTroopHeadings.map((key) => w(key))}
      >
        {contingent.options.map((option) => (
          <TroopOptionRows key={option.id} option={option} />
        ))}
      </FrozenTable>
    </Section>
  );
}

function BattleCardRow({ card }: { card: SheetBattleCard }) {
  const w = useSheetWords();
  return (
    <StackedTableRow>
      <dl className={cardColumns}>
        <StackedTableField label={w('card')}>
          <span className="font-medium">{card.name}</span>
          {card.attachedTo.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              {card.attachedTo.join(' · ')}
            </span>
          )}
        </StackedTableField>
        <StackedTableField label={w('copies')}>
          <span className="tabular-nums">{card.purchases}</span>
        </StackedTableField>
        <StackedTableField label={w('stands')}>
          <span className="tabular-nums">{cardStandsCell(card)}</span>
        </StackedTableField>
        <StackedTableField label={w('points')}>
          <span className="tabular-nums">{formatPoints(card.points)}</span>
        </StackedTableField>
      </dl>
    </StackedTableRow>
  );
}

function SharedProvenance({ view }: { view: SharedView }) {
  const locale = useLocale();
  const w = useSheetWords();
  const s = useTranslations('share');
  const { list, sheet } = view;
  return (
    <>
      {w('sharedOn', {
        date: formatDate(list.createdAt, locale),
        version: list.dataVersion,
      })}
      <a
        className={linkClass}
        href={listSheetUrl({
          code: encodeShareCode(list),
          name: list.name,
          share: list.id,
          lang: locale,
          disposition: 'inline',
        })}
        target="_blank"
        rel="noreferrer"
      >
        {s('openAsPdf')}
      </a>
      {s('orSeparator')}
      <Link className={linkClass} href={buildArmyUrl(sheet.armyId)}>
        {s('buildYourOwn', { army: sheet.armyName })}
      </Link>
      .
    </>
  );
}

function SavedProvenance({ view }: { view: SavedView }) {
  const locale = useLocale();
  const s = useTranslations('share');
  const { list } = view;
  return (
    <>
      {s('savedOn', {
        date: formatDate(list.updatedAt, locale),
        version: list.dataVersion,
      })}
      {s('followsEdits')}
      <Link className={linkClass} href={savedListUrl(list)}>
        {s('editInBuilder')}
      </Link>
      .
    </>
  );
}

function DraftProvenance() {
  const s = useTranslations('share');
  return s('notSavedYet');
}

function Provenance({ view }: { view: ListView }) {
  switch (view.kind) {
    case 'saved':
      return <SavedProvenance view={view} />;
    case 'shared':
      return <SharedProvenance view={view} />;
    case 'draft':
      return <DraftProvenance />;
  }
}

export function SharedCopyBadge() {
  const s = useTranslations('share');
  return (
    <Badge variant="secondary" className="shrink-0">
      {s('sharedCopy')}
    </Badge>
  );
}

export function SharedListView({
  view,
  currentDataVersion,
}: {
  view: ListView;
  currentDataVersion: string;
}) {
  const locale = useLocale();
  const w = useSheetWords();
  const { list, sheet, report, meter } = view;
  return (
    <>
      <PointsMeterBar
        meter={meter}
        trailing={<LegalityBadge report={report} />}
      />

      <DataVersionNotice
        savedVersion={list.dataVersion}
        currentVersion={currentDataVersion}
      />

      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sheetFacts(sheet, w, locale).map(({ key, label, value }) => (
              <Fact key={key} label={label}>
                {value}
              </Fact>
            ))}
          </dl>
        </CardContent>
      </Card>

      {sheet.contingents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{w('emptyList')}</p>
      ) : (
        sheet.contingents.map((contingent) => (
          <ContingentSection key={contingent.id} contingent={contingent} />
        ))
      )}

      <Section title={w('battleCards')}>
        {sheet.battleCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">{w('noBattleCards')}</p>
        ) : (
          <StackedTable
            columns={cardColumns}
            headings={sheetCardHeadings.map((key) => w(key))}
          >
            {sheet.battleCards.map((card) => (
              <BattleCardRow key={card.code} card={card} />
            ))}
          </StackedTable>
        )}
      </Section>

      <ValidationPanel report={report} anchors={noAnchors} />

      <p className="max-w-reading text-xs/relaxed text-pretty text-muted-foreground">
        <Provenance view={view} />
      </p>
    </>
  );
}
