import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import type { ReactNode } from 'react';
import { ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const frozenEdge =
  'group-data-overflow-x-start/frozen:shadow-[inset_-1px_0_0_var(--color-border),6px_0_6px_-6px_oklch(0_0_0/0.35)]';

const headingCell =
  'sticky top-0 border-b bg-card px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground';

type Align = 'start' | 'end';

export type FrozenHeading =
  | string
  | { label: string; align?: Align; hidden?: boolean };

const alignClass = { start: 'text-left', end: 'text-right' } as const;

const headingOf = (heading: FrozenHeading) =>
  typeof heading === 'string'
    ? { label: heading, align: 'end' as const, hidden: false }
    : { align: 'end' as const, hidden: false, ...heading };

export function FrozenTable({
  label,
  headings,
  children,
}: {
  label: string;
  headings: readonly FrozenHeading[];
  children: ReactNode;
}) {
  const [rowHeading, ...columns] = headings;
  return (
    <ScrollAreaPrimitive.Root className="group/frozen relative isolate rounded-lg bg-card ring-1 ring-foreground/10">
      <ScrollAreaPrimitive.Viewport className="max-h-[calc(100svh-11rem)] rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <table
          aria-label={label}
          className="w-full border-separate border-spacing-0 text-sm"
        >
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(headingCell, 'left-0 z-30 text-left', frozenEdge)}
              >
                {rowHeading && headingOf(rowHeading).label}
              </th>
              {columns.map(headingOf).map(({ label: text, align, hidden }) => (
                <th
                  key={text}
                  scope="col"
                  className={cn(headingCell, 'z-10', alignClass[align])}
                >
                  {hidden ? <span className="sr-only">{text}</span> : text}
                </th>
              ))}
            </tr>
          </thead>
          {children}
        </table>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-40 w-8 rounded-r-lg bg-linear-to-l from-card to-transparent opacity-0 transition-opacity group-data-overflow-x-end/frozen:opacity-100"
      />
    </ScrollAreaPrimitive.Root>
  );
}

export function FrozenTableGroup({ children }: { children: ReactNode }) {
  return (
    <tbody className="[&:not(:first-of-type)>tr:first-child>*]:border-t">
      {children}
    </tbody>
  );
}

export function FrozenTableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function FrozenTableRowHeading({ children }: { children: ReactNode }) {
  return (
    <th
      scope="row"
      className={cn(
        'sticky left-0 z-20 min-w-36 bg-card px-3 py-3 text-left align-top font-normal',
        frozenEdge,
      )}
    >
      {children}
    </th>
  );
}

export function FrozenTableCell({
  align = 'end',
  children,
}: {
  align?: Align;
  children: ReactNode;
}) {
  return (
    <td
      className={cn(
        'px-3 py-3 align-top whitespace-nowrap tabular-nums',
        alignClass[align],
      )}
    >
      {children}
    </td>
  );
}
