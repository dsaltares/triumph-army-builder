import {
  IconBoxMultiple,
  IconCircleCheck,
  IconPlus,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  AddTag,
  type CoveredDemand,
  CoverWith,
  Unpin,
} from '@/components/collection/coverage-pins';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import {
  FrozenTable,
  FrozenTableCell,
  FrozenTableGroup,
  FrozenTableRow,
  FrozenTableRowHeading,
} from '@/components/frozen-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { TroopOptionId } from '@/lib/domain/army/army-list';
import type { CollectionReading } from '@/lib/domain/army/shared-view';
import type {
  CoverageLine,
  CoverageSource,
  ListCoverage,
} from '@/lib/domain/collection/list-coverage';
import { formatPoints } from '@/lib/format';
import { newCollectionEntryUrl, routes } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const headingKeys = [
  { key: 'troops', align: 'start' },
  { key: 'need', align: 'end' },
  { key: 'covered', align: 'end' },
  { key: 'fromCollection', align: 'start' },
  { key: 'stillToDo', align: 'start' },
  { key: 'actions', align: 'start', hidden: true },
] as const;

type ReadDemand = {
  armyId: string | null;
  option: TroopOptionId;
  line: CoverageLine;
};

const pinnable = ({ armyId, ...demand }: ReadDemand): CoveredDemand | null =>
  armyId === null ? null : { armyId, ...demand };

const useCoverageWords = () => useTranslations('coverage');

function GoToCollection() {
  const t = useCoverageWords();
  return (
    <Link
      href={routes.collection}
      className={buttonVariants({ variant: 'outline', size: 'touch' })}
    >
      {t('goToCollection')}
    </Link>
  );
}

export function CollectionLink() {
  const t = useCoverageWords();
  return (
    <Link
      href={routes.collection}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'touch' }),
        'shrink-0',
      )}
    >
      <IconBoxMultiple data-icon="inline-start" />
      {t('collection')}
    </Link>
  );
}

function NeedsAccount() {
  const t = useCoverageWords();
  const auth = useTranslations('auth');
  return (
    <EmptyState
      title={t('needsAccountTitle')}
      actions={
        <>
          <Link
            href={routes.signIn}
            className={buttonVariants({ size: 'touch' })}
          >
            {auth('signIn')}
          </Link>
          <Link
            href={routes.signUp}
            className={buttonVariants({ variant: 'outline', size: 'touch' })}
          >
            {t('createAccount')}
          </Link>
        </>
      }
    >
      <EmptyStateText>{t('needsAccountBody')}</EmptyStateText>
    </EmptyState>
  );
}

const coverageSummary = (
  { coveredPoints, points, toPaint, toBuy }: ListCoverage,
  t: ReturnType<typeof useCoverageWords>,
) =>
  [
    t('summary', {
      covered: formatPoints(coveredPoints),
      total: formatPoints(points),
    }),
    ...(toPaint > 0 ? [t('toPaintSummary', { count: toPaint })] : []),
    ...(toBuy > 0 ? [t('toBuySummary', { count: toBuy })] : []),
    ...(toPaint === 0 && toBuy === 0 ? [t('readyToField')] : []),
  ].join(' · ');

function Source({
  source,
  ...demand
}: ReadDemand & { source: CoverageSource }) {
  const t = useCoverageWords();
  const pinning = pinnable(demand);
  return (
    <li className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={source.fit === 'match' ? 'success' : 'info'}>
          {source.fit === 'match' ? t('match') : t('standIn')}
        </Badge>
        <span>
          {source.name} × {source.stands}
        </span>
        {source.status !== 'painted' && (
          <Badge variant="outline">{t(source.status)}</Badge>
        )}
        {source.pinned && <Badge variant="secondary">{t('pinned')}</Badge>}
      </div>
      {pinning && (source.pinned || source.suggestedTags.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {source.pinned && <Unpin {...pinning} source={source} />}
          <AddTag source={source} />
        </div>
      )}
    </li>
  );
}

function StillToDo({ line }: { line: CoverageLine }) {
  const t = useCoverageWords();
  if (line.toBuy === 0 && line.toPaint === 0) {
    return <Badge variant="success">{t('ready')}</Badge>;
  }
  return (
    <div className="flex gap-1">
      {line.toBuy > 0 && (
        <Badge variant="destructive">{t('toBuy', { count: line.toBuy })}</Badge>
      )}
      {line.toPaint > 0 && (
        <Badge variant="warning">{t('toPaint', { count: line.toPaint })}</Badge>
      )}
    </div>
  );
}

const rowActionClass = 'text-xs';

function RowActions(demand: ReadDemand) {
  const t = useCoverageWords();
  const pinning = pinnable(demand);
  const { line } = demand;
  return (
    <div className="flex gap-2">
      {pinning && <CoverWith {...pinning} className={rowActionClass} />}
      {line.toBuy > 0 && (
        <Link
          href={newCollectionEntryUrl(line.troopType)}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'touch' }),
            rowActionClass,
          )}
        >
          <IconPlus data-icon="inline-start" />
          {t('addEntry')}
        </Link>
      )}
    </div>
  );
}

function CoverageRow({
  description,
  ...demand
}: ReadDemand & { description: string }) {
  const { line } = demand;
  const t = useCoverageWords();
  return (
    <FrozenTableRow>
      <FrozenTableRowHeading>
        <span className="font-medium">{line.name}</span>
        {description && (
          <span className="block text-xs text-pretty text-muted-foreground">
            {description}
          </span>
        )}
      </FrozenTableRowHeading>
      <FrozenTableCell>{line.stands}</FrozenTableCell>
      <FrozenTableCell>{line.covered}</FrozenTableCell>
      <FrozenTableCell align="start">
        {line.sources.length === 0 && line.candidates.length === 0 ? (
          <span className="text-muted-foreground">{t('nothingFits')}</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {line.sources.map((source) => (
              <Source key={source.entry} {...demand} source={source} />
            ))}
          </ul>
        )}
      </FrozenTableCell>
      <FrozenTableCell align="start">
        <StillToDo line={line} />
      </FrozenTableCell>
      <FrozenTableCell align="start">
        <RowActions {...demand} />
      </FrozenTableCell>
    </FrozenTableRow>
  );
}

function Coverage({
  armyId,
  coverage,
}: {
  armyId: string | null;
  coverage: ListCoverage;
}) {
  const t = useCoverageWords();
  if (coverage.entries === 0) {
    return (
      <EmptyState
        title={t('emptyCollectionTitle')}
        actions={<GoToCollection />}
      >
        <EmptyStateText>{t('emptyCollectionBody')}</EmptyStateText>
      </EmptyState>
    );
  }
  if (coverage.stands === 0) {
    return <p className="text-sm text-muted-foreground">{t('emptyList')}</p>;
  }
  const ready = coverage.toBuy === 0 && coverage.toPaint === 0;
  const headings = headingKeys.map(({ key, ...heading }) => ({
    label: t(key),
    ...heading,
  }));
  return (
    <>
      <p className="text-sm font-medium">{coverageSummary(coverage, t)}</p>
      {ready && (
        <Alert variant="success">
          <IconCircleCheck />
          <AlertTitle>{t('fullyCovered')}</AlertTitle>
          <AlertDescription>{t('fullyCoveredBody')}</AlertDescription>
        </Alert>
      )}
      {coverage.contingents.map((contingent) => (
        <div key={contingent.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{contingent.name}</h3>
          <FrozenTable label={contingent.name} headings={headings}>
            {contingent.options.map((option) => (
              <FrozenTableGroup key={option.id}>
                {option.lines.map((line) => (
                  <CoverageRow
                    key={line.troopType}
                    armyId={armyId}
                    option={option.id}
                    line={line}
                    description={option.description}
                  />
                ))}
              </FrozenTableGroup>
            ))}
          </FrozenTable>
        </div>
      ))}
    </>
  );
}

export function CoverageReading({
  armyId,
  collection,
}: {
  armyId: string | null;
  collection: CollectionReading;
}) {
  return collection.kind === 'needsAccount' ? (
    <NeedsAccount />
  ) : (
    <Coverage armyId={armyId} coverage={collection} />
  );
}

export type SheetControl = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CanIBuildItSheet({
  description,
  collectionLink,
  control,
  children,
}: {
  description: string;
  collectionLink: boolean;
  control: SheetControl;
  children: ReactNode;
}) {
  const t = useCoverageWords();
  return (
    <Sheet {...control}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mx-auto w-full max-w-5xl flex-row flex-wrap items-start justify-between gap-x-3 gap-y-2 pr-14 pb-3">
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
            <SheetTitle className="text-base">{t('canIBuildIt')}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </div>
          {collectionLink && <CollectionLink />}
        </SheetHeader>
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CollectionCoverage({
  armyId,
  collection,
  control,
}: {
  armyId: string | null;
  collection: CollectionReading;
  control: SheetControl;
}) {
  const t = useCoverageWords();
  return (
    <CanIBuildItSheet
      description={t('description')}
      collectionLink={collection.kind !== 'needsAccount'}
      control={control}
    >
      <CoverageReading armyId={armyId} collection={collection} />
    </CanIBuildItSheet>
  );
}
