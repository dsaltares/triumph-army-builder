import type { z } from 'zod';
import { bundlePaths } from './bundle.ts';
import {
  armyDetailSchema,
  armyIndexSchema,
  battleCardTextSchema,
  bundledBattleCardsSchema,
  bundledFantasyCardsSchema,
  bundledTroopTypesSchema,
  fantasyCardTextSchema,
  tagWordsSchema,
} from './bundle-schema.ts';
import { fantasyFormatSchema } from './curation-schema.ts';
import { type Game, thematicCategorySchema } from './schema.ts';
import { summarisedIssues } from './zod-issues.ts';

const armyIdPattern = /^[A-Za-z0-9_-]+$/;

const once = <Output>(load: () => Promise<Output>) => {
  let pending: Promise<Output> | null = null;
  return () => {
    pending ??= load();
    return pending;
  };
};

export type BundleDocuments = {
  read: (path: string) => Promise<string | null>;
  missing: (path: string) => string;
};

export const documentBundleSource = ({ read, missing }: BundleDocuments) => {
  const parsed = async <Output>(path: string, schema: z.ZodType<Output>) => {
    const contents = await read(path);
    if (contents === null) {
      return null;
    }
    const result = schema.safeParse(JSON.parse(contents));
    if (!result.success) {
      throw new Error(
        `${path} does not match the data bundle schema (${summarisedIssues(result.error)})`,
      );
    }
    return result.data;
  };

  const required = async <Output>(path: string, schema: z.ZodType<Output>) => {
    const contents = await parsed(path, schema);
    if (contents === null) {
      throw new Error(missing(path));
    }
    return contents;
  };

  const readArmyIndex = once(() =>
    required(bundlePaths.index, armyIndexSchema),
  );

  const readFantasyBattleCards = once(() =>
    parsed(bundlePaths.fantasy.battleCards, bundledFantasyCardsSchema),
  );

  const readArmyDetail = (id: string) =>
    armyIdPattern.test(id)
      ? parsed(bundlePaths.army(id), armyDetailSchema)
      : Promise.resolve(null);

  return {
    readArmyIndex,
    readTroopTypes: once(() =>
      required(bundlePaths.troopTypes, bundledTroopTypesSchema),
    ),
    readBattleCards: once(() =>
      required(bundlePaths.battleCards, bundledBattleCardsSchema),
    ),
    readBattleCardText: once(() =>
      required(bundlePaths.battleCardText, battleCardTextSchema),
    ),
    readThematicCategories: once(() =>
      required(bundlePaths.thematicCategories, thematicCategorySchema.array()),
    ),
    readTagWords: once(() => required(bundlePaths.tagWords, tagWordsSchema)),
    readArmyDetail,
    readArmyDetails: once(async () => {
      const { armies } = await readArmyIndex();
      const details = await Promise.all(
        armies.map(({ id }) => readArmyDetail(id)),
      );
      return details.filter((detail) => detail !== null);
    }),
    readGames: once(
      async (): Promise<Game[]> =>
        (await readFantasyBattleCards()) === null
          ? ['triumph']
          : ['triumph', 'fantasy'],
    ),
    readFantasyTroopTypes: once(() =>
      parsed(bundlePaths.fantasy.troopTypes, bundledTroopTypesSchema),
    ),
    readFantasyBattleCards,
    readFantasyBattleCardText: once(() =>
      parsed(bundlePaths.fantasy.battleCardText, fantasyCardTextSchema),
    ),
    readFantasyFormat: once(() =>
      parsed(bundlePaths.fantasy.format, fantasyFormatSchema),
    ),
  };
};

export type BundleSource = ReturnType<typeof documentBundleSource>;

export type ArmyBundle = Pick<
  BundleSource,
  'readArmyDetail' | 'readBattleCards' | 'readTroopTypes'
>;

export type FantasyBundle = Pick<
  BundleSource,
  'readFantasyTroopTypes' | 'readFantasyBattleCards' | 'readFantasyFormat'
>;

export type ListBundle = ArmyBundle & FantasyBundle;

export type CollectionBundle = Pick<
  BundleSource,
  'readArmyDetails' | 'readBattleCards' | 'readTroopTypes'
>;
