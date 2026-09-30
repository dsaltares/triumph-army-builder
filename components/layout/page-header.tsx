import type { ReactNode } from 'react';
import { BackLink } from '@/components/layout/back-link';

export const pageHeading =
  'min-w-0 font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl';

export function PageHeader({
  title,
  meta,
  description,
  action,
  back,
}: {
  title: ReactNode;
  meta?: ReactNode;
  description?: string | undefined;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <div className="flex min-h-11 min-w-0 items-center gap-2">
          {typeof title === 'string' ? (
            <h1 className={pageHeading}>{title}</h1>
          ) : (
            title
          )}
          {meta}
        </div>
        {description ? (
          <p className="max-w-reading text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );

  return back ? (
    <div className="flex flex-col gap-3">
      <BackLink href={back.href}>{back.label}</BackLink>
      {header}
    </div>
  ) : (
    header
  );
}
