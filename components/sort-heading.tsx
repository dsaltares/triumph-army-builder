import {
  IconArrowDown,
  IconArrowsSort,
  IconArrowUp,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SortedDirection = 'asc' | 'desc' | false;

const sortIcons = {
  asc: IconArrowUp,
  desc: IconArrowDown,
  none: IconArrowsSort,
};

const ariaSort = (sorted: SortedDirection) => {
  if (sorted === 'asc') {
    return 'ascending';
  }
  return sorted === 'desc' ? 'descending' : 'none';
};

export function SortHeading({
  sorted,
  onSort,
  className,
  children,
}: {
  sorted: SortedDirection;
  onSort?: ((event: unknown) => void) | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const Icon = sortIcons[sorted === false ? 'none' : sorted];
  return (
    <th
      scope="col"
      aria-sort={onSort ? ariaSort(sorted) : undefined}
      className={cn(
        'py-2 pr-3 text-left text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {children}
          <Icon
            className={cn(
              'size-3',
              sorted === false && 'text-muted-foreground/60',
            )}
          />
        </button>
      ) : (
        children
      )}
    </th>
  );
}
