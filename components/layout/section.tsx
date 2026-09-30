import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Section({
  id,
  className,
  title,
  description,
  children,
}: {
  id?: string;
  className?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="max-w-reading text-xs text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
