import { IconPencil, IconPhoto, IconTrash } from '@tabler/icons-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { photoPath } from '@/components/collection/photo-urls';
import { SortHeading } from '@/components/sort-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CollectionPhotoCover } from '@/lib/db/collection-photos';
import type {
  CollectionColumn,
  CollectionSort,
} from '@/lib/domain/collection/collection-index';
import type {
  CollectionEntry,
  CollectionStatus,
} from '@/lib/domain/collection/entry';
import { cn } from '@/lib/utils';

const sortableColumns = [
  { column: 'name', label: 'columnEntry' },
  { column: 'stands', label: 'columnStands', className: 'w-16' },
  { column: 'troopType', label: 'columnTroopTypes' },
  { column: 'status', label: 'columnStatus', className: 'w-28' },
] as const satisfies readonly {
  column: CollectionColumn;
  label: string;
  className?: string;
}[];

const cellClass = 'py-3 pr-3 align-middle';

const coverEdge = 44;

const statusBadges = {
  painted: 'success',
  inProgress: 'warning',
  unpainted: 'outline',
} as const satisfies Record<CollectionStatus, string>;

export type EntryCovers = Readonly<Record<string, CollectionPhotoCover>>;

const coverSlotClass = 'size-11 shrink-0 overflow-hidden rounded-md bg-muted';

function EntryCover({
  entry,
  cover,
  onView,
}: {
  entry: CollectionEntry;
  cover: CollectionPhotoCover | undefined;
  onView: (entry: CollectionEntry, cover: CollectionPhotoCover) => void;
}) {
  const t = useTranslations('collection');
  if (!cover) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          coverSlotClass,
          'flex items-center justify-center text-muted-foreground',
        )}
      >
        <IconPhoto className="size-4" />
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={t('viewPhotos', { name: entry.name })}
      className={cn(
        coverSlotClass,
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
      onClick={() => onView(entry, cover)}
    >
      <Image
        unoptimized
        src={photoPath(cover.id, 'thumb')}
        alt={t('coverAlt', { name: entry.name })}
        width={coverEdge}
        height={coverEdge}
        className="size-full object-cover"
      />
    </button>
  );
}

function EntryRow({
  entry,
  cover,
  onView,
  onEdit,
  onDelete,
}: {
  entry: CollectionEntry;
  cover: CollectionPhotoCover | undefined;
  onView: (entry: CollectionEntry, cover: CollectionPhotoCover) => void;
  onEdit: (entry: CollectionEntry) => void;
  onDelete: (entry: CollectionEntry) => void;
}) {
  const t = useTranslations('collection');
  return (
    <tr className="border-b border-border">
      <th scope="row" className={cn(cellClass, 'text-left font-normal')}>
        <span className="flex items-center gap-3">
          <EntryCover entry={entry} cover={cover} onView={onView} />
          <span className="min-w-0">
            <span className="font-medium">{entry.name}</span>
            {entry.tags.length > 0 && (
              <span className="block text-xs text-pretty text-muted-foreground">
                {entry.tags.join(' · ')}
              </span>
            )}
          </span>
        </span>
      </th>
      <td className={cn(cellClass, 'tabular-nums')}>{entry.count}</td>
      <td className={cellClass}>
        <Badge variant="secondary">{entry.troopType}</Badge>
      </td>
      <td className={cellClass}>
        <Badge variant={statusBadges[entry.status]}>{t(entry.status)}</Badge>
      </td>
      <td className={cn(cellClass, 'pr-0')}>
        <span className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t('editEntry', { name: entry.name })}
            onClick={() => onEdit(entry)}
          >
            <IconPencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t('deleteEntryNamed', { name: entry.name })}
            onClick={() => onDelete(entry)}
          >
            <IconTrash className="size-4" />
          </Button>
        </span>
      </td>
    </tr>
  );
}

export function CollectionTable({
  entries,
  covers,
  sort,
  onSort,
  onView,
  onEdit,
  onDelete,
}: {
  entries: readonly CollectionEntry[];
  covers: EntryCovers;
  sort: CollectionSort | null;
  onSort: (column: CollectionColumn) => void;
  onView: (entry: CollectionEntry, cover: CollectionPhotoCover) => void;
  onEdit: (entry: CollectionEntry) => void;
  onDelete: (entry: CollectionEntry) => void;
}) {
  const t = useTranslations('collection');
  return (
    <div className="-mx-gutter overflow-x-auto px-gutter">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {sortableColumns.map((heading) => (
              <SortHeading
                key={heading.column}
                sorted={sort?.column === heading.column && sort.direction}
                onSort={() => onSort(heading.column)}
                className={
                  'className' in heading ? heading.className : undefined
                }
              >
                {t(heading.label)}
              </SortHeading>
            ))}
            <SortHeading sorted={false} className="w-22 pr-0">
              <span className="sr-only">{t('columnActions')}</span>
            </SortHeading>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              cover={covers[entry.id]}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
