import type { StoredSavedList } from './saved-army.ts';

export const anonymousShareLimit = 100;

export const shareIdLength = 12;

export const shareIdPattern = new RegExp(`^[A-Za-z0-9_-]{${shareIdLength}}$`);

export type SharedList = StoredSavedList & {
  id: string;
  name: string;
  dataVersion: string;
  createdAt: string;
};
