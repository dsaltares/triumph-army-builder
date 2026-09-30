'use client';

import { useLocale } from 'next-intl';
import {
  StackedTable,
  StackedTableField,
  StackedTableRow,
} from '@/components/stacked-table';
import { formatCount } from '@/lib/format';

export type CountRow = {
  key: string;
  labels: readonly string[];
  count: number;
};

const columnsFor = {
  1: 'grid gap-x-4 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_6rem] sm:py-2',
  2: 'grid gap-x-4 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem] sm:py-2',
} as const;

export function CountTable({
  title,
  labelColumns,
  countColumn,
  rows,
}: {
  title: string;
  labelColumns: readonly [string] | readonly [string, string];
  countColumn: string;
  rows: readonly CountRow[];
}) {
  const locale = useLocale();
  const columns = columnsFor[labelColumns.length];
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h3 className="font-heading text-base font-semibold tracking-tight">
        {title}
      </h3>
      <StackedTable columns={columns} headings={[...labelColumns, countColumn]}>
        {rows.map((row) => (
          <StackedTableRow key={row.key}>
            <dl className={columns}>
              {labelColumns.map((column, index) => (
                <StackedTableField key={column} label={column}>
                  {row.labels[index]}
                </StackedTableField>
              ))}
              <StackedTableField label={countColumn} className="tabular-nums">
                {formatCount(row.count, locale)}
              </StackedTableField>
            </dl>
          </StackedTableRow>
        ))}
      </StackedTable>
    </section>
  );
}
