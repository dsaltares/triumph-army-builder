import type { Game, TroopTypeCode } from '../../data/schema.ts';

export const collectionStatuses = [
  'unpainted',
  'inProgress',
  'painted',
] as const;

export type CollectionStatus = (typeof collectionStatuses)[number];

export const collectionEntryKinds = ['stands', 'hero'] as const;

export type CollectionEntryKind = (typeof collectionEntryKinds)[number];

type EntryFields = {
  id: string;
  name: string;
  count: number;
  tags: string[];
  games: Game[];
  status: CollectionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type StandsEntry = EntryFields & {
  kind: 'stands';
  troopType: TroopTypeCode;
};

export type HeroEntry = EntryFields & { kind: 'hero' };

export type CollectionEntry = StandsEntry | HeroEntry;

export type HeroKind = { kind: 'hero' };

export const isHeroEntry = (entry: object): entry is HeroKind =>
  'kind' in entry && entry.kind === 'hero';

export const withoutHeroes = <Entry extends object>(
  entries: readonly Entry[],
): Exclude<Entry, HeroKind>[] =>
  entries.filter(
    (entry): entry is Exclude<Entry, HeroKind> => !isHeroEntry(entry),
  );

export const heroGames: readonly Game[] = ['fantasy'];

export const standsGames: readonly Game[] = ['triumph'];

export const defaultGamesOf = (kind: CollectionEntryKind | undefined) =>
  kind === 'hero' ? heroGames : standsGames;

type GamedEntry = {
  kind?: CollectionEntryKind;
  games?: readonly Game[];
};

export const belongsTo = ({ kind, games }: GamedEntry, game: Game) =>
  (games ?? defaultGamesOf(kind)).includes(game);

export const triumphStands = <Entry extends object>(
  entries: readonly Entry[],
): Exclude<Entry, HeroKind>[] =>
  withoutHeroes(entries).filter((entry) => belongsTo(entry, 'triumph'));
