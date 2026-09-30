import type { TroopTypeCode } from '../../data/schema.ts';

export const collectionStatuses = [
  'unpainted',
  'inProgress',
  'painted',
] as const;

export type CollectionStatus = (typeof collectionStatuses)[number];

export type CollectionEntry = {
  id: string;
  name: string;
  count: number;
  troopType: TroopTypeCode;
  tags: string[];
  status: CollectionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
