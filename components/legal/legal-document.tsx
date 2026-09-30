import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

export const lastUpdated = '29 September 2026';

export const supportEmail = 'saltares.dev@gmail.com';

export function LegalDocument({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  // These three documents stay in English whatever the app is set to, so they
  // say so: without this the page is `lang="es"` and a screen reader reads
  // English prose with Spanish pronunciation.
  return (
    <div lang="en">
      <PageHeader title={title} description={summary} />
      <p className="max-w-reading text-xs text-muted-foreground">
        triumph.saltares.dev · Last updated {lastUpdated}
      </p>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
      {children}
    </h3>
  );
}

export function Prose({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex max-w-reading flex-col gap-3 text-sm text-pretty text-muted-foreground',
        '[&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-foreground',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground',
        '[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <Prose className="rounded-lg border-l-2 border-ring bg-card px-4 py-3 ring-1 ring-foreground/10">
      {children}
    </Prose>
  );
}

export type LegalTableRow = {
  key: string;
  cells: readonly ReactNode[];
};

export function LegalTable({
  columns,
  headings,
  rows,
}: {
  columns: string;
  headings: readonly string[];
  rows: readonly LegalTableRow[];
}) {
  return (
    <div className="max-w-reading text-sm text-muted-foreground">
      <div
        aria-hidden="true"
        className={cn(
          columns,
          'hidden gap-x-4 border-b pb-2 text-xs font-medium text-foreground sm:grid',
        )}
      >
        {headings.map((heading) => (
          <span key={heading}>{heading}</span>
        ))}
      </div>
      <ul className="flex flex-col gap-3 sm:gap-0 sm:divide-y">
        {rows.map(({ key, cells }) => (
          <li
            key={key}
            className="rounded-lg bg-card p-3 ring-1 ring-foreground/10 sm:rounded-none sm:bg-transparent sm:p-0 sm:py-3 sm:ring-0"
          >
            <dl className={cn(columns, 'flex flex-col gap-3 sm:gap-x-4')}>
              {cells.map((cell, position) => (
                <div
                  key={headings[position] ?? String(position)}
                  className="flex flex-col gap-0.5"
                >
                  <dt className="text-xs font-medium text-foreground sm:sr-only">
                    {headings[position]}
                  </dt>
                  <dd className="text-pretty [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
                    {cell}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
