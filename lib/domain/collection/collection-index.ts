import { type TroopTypeCode, troopTypeCodes } from '../../data/schema.ts';
import { matchesAllTerms, searchTerms } from '../text-search.ts';
import {
  type CollectionEntry,
  type CollectionStatus,
  collectionStatuses,
} from './entry.ts';

export type CollectionFilters = {
  search: string;
  troopTypes: TroopTypeCode[];
  statuses: CollectionStatus[];
  tags: string[];
};

export type CollectionTotals = {
  owned: number;
  painted: number;
  toPaint: number;
};

type IndexedEntry = Pick<CollectionEntry, 'count' | 'status' | 'troopType'>;

type SearchableEntry = IndexedEntry & Pick<CollectionEntry, 'name' | 'tags'>;

export const noCollectionFilters: CollectionFilters = {
  search: '',
  troopTypes: [],
  statuses: [],
  tags: [],
};

export const activeCollectionFilterCount = ({
  troopTypes,
  statuses,
  tags,
}: Omit<CollectionFilters, 'search'>) =>
  troopTypes.length + statuses.length + tags.length;

const fieldsAsAnyOf = (
  entry: IndexedEntry,
  troopTypes: readonly TroopTypeCode[],
) => troopTypes.length === 0 || troopTypes.includes(entry.troopType);

const hasAnyOf = (entry: IndexedEntry, statuses: readonly CollectionStatus[]) =>
  statuses.length === 0 || statuses.includes(entry.status);

const taggedAnyOf = (entry: SearchableEntry, tags: readonly string[]) =>
  tags.length === 0 || entry.tags.some((tag) => tags.includes(tag));

const matchesSearch = (entry: SearchableEntry, terms: readonly string[]) =>
  terms.length === 0 ||
  matchesAllTerms([entry.name, entry.troopType, ...entry.tags], terms);

export const filterCollection = <Entry extends SearchableEntry>(
  entries: readonly Entry[],
  { search, troopTypes, statuses, tags }: CollectionFilters,
) => {
  const terms = searchTerms(search);
  return entries.filter(
    (entry) =>
      matchesSearch(entry, terms) &&
      fieldsAsAnyOf(entry, troopTypes) &&
      hasAnyOf(entry, statuses) &&
      taggedAnyOf(entry, tags),
  );
};

export const collectionTroopTypes = (
  entries: readonly IndexedEntry[],
  chosen: readonly TroopTypeCode[] = [],
): TroopTypeCode[] => {
  const fielded = new Set([
    ...entries.map(({ troopType }) => troopType),
    ...chosen,
  ]);
  return troopTypeCodes.filter((code) => fielded.has(code));
};

export const collectionTags = (
  entries: readonly Pick<CollectionEntry, 'tags'>[],
  chosen: readonly string[] = [],
): string[] =>
  [...new Set([...entries.flatMap(({ tags }) => tags), ...chosen])].sort(
    (left, right) => left.localeCompare(right),
  );

export const collectionTotals = (
  entries: readonly IndexedEntry[],
): CollectionTotals =>
  entries.reduce(
    (totals, { count, status }) => ({
      owned: totals.owned + count,
      painted: totals.painted + (status === 'painted' ? count : 0),
      toPaint: totals.toPaint + (status === 'painted' ? 0 : count),
    }),
    { owned: 0, painted: 0, toPaint: 0 },
  );

export const collectionColumns = [
  'name',
  'stands',
  'troopType',
  'status',
] as const;

export type CollectionColumn = (typeof collectionColumns)[number];

export const sortDirections = ['asc', 'desc'] as const;

export type SortDirection = (typeof sortDirections)[number];

export type CollectionSort = {
  column: CollectionColumn;
  direction: SortDirection;
};

export const firstDirection = (column: CollectionColumn): SortDirection =>
  column === 'stands' ? 'desc' : 'asc';

export const nextCollectionSort = (
  current: CollectionSort | null,
  column: CollectionColumn,
): CollectionSort =>
  current?.column === column
    ? {
        column,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      }
    : { column, direction: firstDirection(column) };

type SortableEntry = SearchableEntry;

const ascending: Record<
  CollectionColumn,
  (left: SortableEntry, right: SortableEntry) => number
> = {
  name: (left, right) => left.name.localeCompare(right.name),
  stands: (left, right) => left.count - right.count,
  troopType: (left, right) => left.troopType.localeCompare(right.troopType),
  status: (left, right) =>
    collectionStatuses.indexOf(left.status) -
    collectionStatuses.indexOf(right.status),
};

export const sortCollection = <Entry extends SortableEntry>(
  entries: readonly Entry[],
  sort: CollectionSort | null,
): readonly Entry[] => {
  if (!sort) {
    return entries;
  }
  const compare = ascending[sort.column];
  const sign = sort.direction === 'asc' ? 1 : -1;
  return entries.toSorted((left, right) => sign * compare(left, right));
};
