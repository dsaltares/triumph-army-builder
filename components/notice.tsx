import { IconAlertTriangle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const severityColours = {
  error: 'text-destructive',
  warning: 'text-warning',
} as const;

export type NoticeSeverity = keyof typeof severityColours;

export function Notice({
  id,
  severity = 'error',
  children,
}: {
  id?: string | undefined;
  severity?: NoticeSeverity;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      className={cn(
        'flex items-start gap-2 text-xs',
        severityColours[severity],
      )}
    >
      <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
