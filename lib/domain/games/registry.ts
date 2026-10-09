import type { Game } from '../game.ts';
import { fantasy } from './fantasy.ts';
import { triumph } from './triumph.ts';

const gameModules = { triumph, fantasy } as const satisfies Record<
  Game,
  unknown
>;

export type GameModules = typeof gameModules;

export const gameModule = <G extends Game>(game: G): GameModules[G] =>
  gameModules[game];
