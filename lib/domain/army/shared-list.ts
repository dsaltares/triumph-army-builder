import type { ViewableGame } from '../game.ts';
import type { ArmySelection } from './selection.ts';

export const anonymousShareLimit = 100;

export const shareIdLength = 12;

export const shareIdPattern = new RegExp(`^[A-Za-z0-9_-]{${shareIdLength}}$`);

export type SharedList = {
  id: string;
  name: string;
  game: ViewableGame;
  armyListId: string;
  dataVersion: string;
  selection: ArmySelection;
  createdAt: string;
};
