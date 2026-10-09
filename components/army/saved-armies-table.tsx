'use client';

import { IconListDetails } from '@tabler/icons-react';
import {
  createColumnHelper,
  createCoreRowModel,
  createSortedRowModel,
  flexRender,
  type Header,
  rowSortingFeature,
  type SortingState,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  type Updater,
  useTable,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { SavedArmyActions } from '@/components/army/saved-army-actions';
import { SavedArmyActionsMenu } from '@/components/army/saved-army-actions';
import { SavedArmyPoints } from '@/components/army/saved-army-points';
import { SortHeading } from '@/components/sort-heading';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import type { SavedArmyEntry } from '@/lib/domain/army/saved-army-index';
import { isViewableList } from '@/lib/domain/army/selection-schema';
import {
  compareDataVersions,
  type DataVersionComparison,
} from '@/lib/domain/data-version';
import { formatTimeAgo } from '@/lib/format';
import { defaultLocale, type Locale } from '@/lib/i18n/routing';
import { armyUrl, listViewUrl, savedListUrl } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type SavedArmyTableMeta = {
  locale: Locale;
  t: ReturnType<typeof useTranslations<'armies'>>;
  g: ReturnType<typeof useTranslations<'games'>>;
  pricing: boolean;
  dataVersion: string;
  actionsFor: (army: SavedArmy) => SavedArmyActions;
};

type SavedArmyColumnMeta = {
  className?: string;
};

const features = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
  tableMeta: {} as SavedArmyTableMeta,
  columnMeta: {} as SavedArmyColumnMeta,
});

const columnHelper = createColumnHelper<typeof features, SavedArmyEntry>();

const at = (iso: string) => new Date(iso).getTime();

const dataVersionLabels = {
  older: 'olderData',
  newer: 'newerData',
  unknown: 'unknownData',
} as const satisfies Record<Exclude<DataVersionComparison, 'current'>, string>;

const columns = [
  columnHelper.accessor(({ army }): unknown => army.name, {
    id: 'name',
    header: 'columnList',
    sortFn: 'text',
    cell: ({ row, table }) => {
      const { army, listName } = row.original;
      return (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href={savedListUrl(army)}
              className="font-medium underline-offset-4 hover:underline"
            >
              {army.name}
            </Link>
            <Badge variant="outline">{table.options.meta?.g(army.game)}</Badge>
          </span>
          <span className="block text-xs text-muted-foreground sm:hidden">
            {listName ?? table.options.meta?.t('armyMissing')}
          </span>
        </>
      );
    },
  }),
  columnHelper.accessor(({ listName }): unknown => listName ?? '', {
    id: 'army',
    header: 'columnArmy',
    sortFn: 'text',
    meta: { className: 'hidden sm:table-cell' },
    cell: ({ row, table }) => {
      const { army, listName } = row.original;
      if (listName && army.armyListId === null) {
        return listName;
      }
      return listName && army.armyListId !== null ? (
        <Link
          href={armyUrl(army.armyListId)}
          className="underline-offset-4 hover:underline"
        >
          {listName}
        </Link>
      ) : (
        <span className="text-muted-foreground">
          {table.options.meta?.t('notInBundle')}
        </span>
      );
    },
  }),
  columnHelper.accessor(({ standing }): unknown => standing?.meter.total, {
    id: 'points',
    header: 'columnPoints',
    sortFn: 'basic',
    sortUndefined: 'last',
    cell: ({ row, table }) => {
      const { standing } = row.original;
      if (standing) {
        return <SavedArmyPoints meter={standing.meter} />;
      }
      return table.options.meta?.pricing ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        <span className="text-xs text-muted-foreground">
          {table.options.meta?.t('unavailable')}
        </span>
      );
    },
  }),
  columnHelper.accessor(
    ({ standing }): unknown =>
      standing ? (standing.legal ? 1 : 0) : undefined,
    {
      id: 'status',
      header: 'columnStatus',
      sortFn: 'basic',
      sortUndefined: 'last',
      cell: ({ row, table }) => {
        const { army, standing } = row.original;
        const comparison = compareDataVersions(
          army.dataVersion,
          table.options.meta?.dataVersion ?? army.dataVersion,
        );
        return (
          <span className="flex flex-wrap items-center gap-1">
            {standing ? (
              <Badge variant={standing.legal ? 'success' : 'destructive'}>
                {standing.legal
                  ? table.options.meta?.t('legal')
                  : table.options.meta?.t('illegal', {
                      count: standing.errors,
                    })}
              </Badge>
            ) : table.options.meta?.pricing ? (
              <Skeleton className="h-5 w-20 rounded-full" />
            ) : null}
            {comparison !== 'current' && (
              <Badge variant="secondary">
                {table.options.meta?.t(dataVersionLabels[comparison])}
              </Badge>
            )}
          </span>
        );
      },
    },
  ),
  columnHelper.accessor(({ army }): unknown => at(army.createdAt), {
    id: 'createdAt',
    header: 'columnCreated',
    sortFn: 'basic',
    meta: { className: 'hidden lg:table-cell' },
    cell: ({ row, table }) => (
      <span className="text-xs text-muted-foreground">
        {formatTimeAgo(
          row.original.army.createdAt,
          table.options.meta?.locale ?? defaultLocale,
        )}
      </span>
    ),
  }),
  columnHelper.accessor(({ army }): unknown => at(army.updatedAt), {
    id: 'updatedAt',
    header: 'columnSaved',
    sortFn: 'basic',
    meta: { className: 'hidden md:table-cell' },
    cell: ({ row, table }) => (
      <span className="text-xs text-muted-foreground">
        {formatTimeAgo(
          row.original.army.updatedAt,
          table.options.meta?.locale ?? defaultLocale,
        )}
      </span>
    ),
  }),
  columnHelper.display({
    id: 'actions',
    header: () => null,
    meta: { className: 'w-22' },
    cell: ({ row, table }) => {
      const { army } = row.original;
      const actions = table.options.meta?.actionsFor(army);
      return (
        <span className="flex items-center justify-end">
          {isViewableList(army) && (
            <Link
              href={listViewUrl(army.id)}
              className={buttonVariants({
                variant: 'ghost',
                size: 'icon-touch',
              })}
            >
              <IconListDetails className="size-4" />
              <span className="sr-only">
                {table.options.meta?.t('viewList', { name: army.name })}
              </span>
            </Link>
          )}
          {actions && <SavedArmyActionsMenu name={army.name} {...actions} />}
        </span>
      );
    },
  }),
];

function ColumnHeader({
  header,
  t,
}: {
  header: Header<typeof features, SavedArmyEntry, unknown>;
  t: ReturnType<typeof useTranslations<'armies'>>;
}) {
  const { column } = header;
  const raw = flexRender(column.columnDef.header, header.getContext());
  const label =
    typeof raw === 'string' ? t(raw as Parameters<typeof t>[0]) : raw;
  return (
    <SortHeading
      sorted={column.getIsSorted()}
      onSort={
        column.getCanSort() ? column.getToggleSortingHandler() : undefined
      }
      className={column.columnDef.meta?.className}
    >
      {label}
    </SortHeading>
  );
}

export type SavedArmiesTableProps = {
  entries: readonly SavedArmyEntry[];
  sorting: SortingState;
  onSortingChange: (updater: Updater<SortingState>) => void;
  pricing: boolean;
  dataVersion: string;
  actionsFor: (army: SavedArmy) => SavedArmyActions;
};

export function SavedArmiesTable({
  entries,
  sorting,
  onSortingChange,
  pricing,
  dataVersion,
  actionsFor,
}: SavedArmiesTableProps) {
  const t = useTranslations('armies');
  const g = useTranslations('games');
  const locale = useLocale();
  const table = useTable({
    features,
    columns,
    data: entries,
    state: { sorting },
    onSortingChange,
    enableSortingRemoval: false,
    meta: { locale, t, g, pricing, dataVersion, actionsFor },
  });

  return (
    <div className="-mx-gutter overflow-x-auto px-gutter">
      <table className="w-full caption-bottom border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b border-border">
              {group.headers.map((header) => (
                <ColumnHeader key={header.id} header={header} t={t} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-border">
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    'py-3 pr-3 align-middle',
                    cell.column.columnDef.meta?.className,
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
