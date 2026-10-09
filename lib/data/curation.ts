import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Curation,
  curationSchema,
  type FantasyCuration,
} from './curation-schema.ts';
import { summarisedIssues } from './zod-issues.ts';

type CuratedFiles = Omit<Curation, 'games'>;

export const curationFiles = {
  movement: 'movement.json',
  basing: 'basing.json',
  battleCardCosts: 'battle-card-costs.json',
  subFactions: 'sub-factions.json',
} as const satisfies Record<keyof CuratedFiles, string>;

export const fantasyCurationDirectory = join('games', 'fantasy');

export const fantasyCurationFiles = {
  troopTypeNames: 'troop-type-names.json',
  cards: 'cards.json',
  text: 'text.json',
  format: 'format.json',
} as const satisfies Record<keyof FantasyCuration, string>;

const readCurationFile = async (directory: string, file: string) =>
  JSON.parse(await readFile(join(directory, file), 'utf8')) as unknown;

export type CurationSources = Record<keyof CuratedFiles, unknown> & {
  games?: { fantasy?: Record<keyof FantasyCuration, unknown> };
};

export const parseCuration = ({ games = {}, ...files }: CurationSources) => {
  const result = curationSchema.safeParse({ ...files, games });
  if (!result.success) {
    throw new Error(
      `the curation does not match its schema (${summarisedIssues(result.error)})`,
    );
  }
  return result.data;
};

const isDirectory = async (path: string) => {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

const loadFantasyFiles = async (directory: string) => {
  const gameDirectory = join(directory, fantasyCurationDirectory);
  if (!(await isDirectory(gameDirectory))) {
    return undefined;
  }
  return {
    troopTypeNames: await readCurationFile(
      gameDirectory,
      fantasyCurationFiles.troopTypeNames,
    ),
    cards: await readCurationFile(gameDirectory, fantasyCurationFiles.cards),
    text: await readCurationFile(gameDirectory, fantasyCurationFiles.text),
    format: await readCurationFile(gameDirectory, fantasyCurationFiles.format),
  };
};

export const loadCuration = async (directory: string): Promise<Curation> => {
  const fantasy = await loadFantasyFiles(directory);
  return parseCuration({
    movement: await readCurationFile(directory, curationFiles.movement),
    basing: await readCurationFile(directory, curationFiles.basing),
    battleCardCosts: await readCurationFile(
      directory,
      curationFiles.battleCardCosts,
    ),
    subFactions: await readCurationFile(directory, curationFiles.subFactions),
    games: fantasy ? { fantasy } : {},
  });
};
