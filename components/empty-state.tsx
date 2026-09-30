import type { ReactNode } from 'react';

export function EmptyState({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border border-dashed p-6">
      <p className="text-sm font-medium">{title}</p>
      {children}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyStateText({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-reading text-xs text-pretty text-muted-foreground">
      {children}
    </p>
  );
}
