import { type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

export function StackedTable({
  columns,
  headings,
  children,
}: {
  columns: string;
  headings: readonly string[];
  children: ReactNode;
}) {
  return (
    <div>
      <div
        aria-hidden="true"
        className={cn(
          columns,
          'hidden border-b text-xs font-medium text-muted-foreground sm:grid',
        )}
      >
        {headings.map((heading) => (
          <span key={heading}>{heading}</span>
        ))}
      </div>
      <ul className="flex flex-col gap-2 sm:gap-0 sm:divide-y">{children}</ul>
    </div>
  );
}

export function StackedTableRow({ children }: { children: ReactNode }) {
  return (
    <li className="rounded-lg bg-card ring-1 ring-foreground/10 sm:rounded-none sm:bg-transparent sm:ring-0">
      {children}
    </li>
  );
}

export function StackedTableField({
  label,
  wide = false,
  className,
  children,
}: {
  label: string;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'text-sm',
        wide
          ? 'col-span-full'
          : 'grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-2 sm:block',
        className,
      )}
    >
      <dt
        className={cn(
          wide ? 'sr-only' : 'text-xs text-muted-foreground sm:sr-only',
        )}
      >
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function StackedTableGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <li>
      <h3
        id={headingId}
        className="pt-4 pb-2 font-heading text-base font-semibold tracking-tight sm:px-3 sm:pt-5 sm:pb-1"
      >
        {title}
      </h3>
      <ul
        aria-labelledby={headingId}
        className="flex flex-col gap-2 sm:gap-0 sm:divide-y"
      >
        {children}
      </ul>
    </li>
  );
}
