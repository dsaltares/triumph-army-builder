import type {
  BattleCardCostRule,
  BattleCardPurchaseScope,
} from '../domain/battle-cards/cost-rules.ts';
import { tagWords } from '../domain/collection/tag-words.ts';
import { byKey } from '../domain/ordering.ts';
import type { TroopTypeBasing } from '../domain/troop-types.ts';
import { defaultLocale } from '../i18n/locales.ts';
import type { Curation } from './curation-schema.ts';
import type {
  ArmyListStatus,
  BattleCardCode,
  MeshweshAllyArmyList,
  MeshweshAllyOption,
  MeshweshArmyList,
  MeshweshBattleCard,
  MeshweshBattleCardEntry,
  MeshweshDateRange,
  MeshweshHomeTopography,
  MeshweshRating,
  MeshweshThematicCategoryArmyLists,
  MeshweshTroopOption,
  MeshweshTroopType,
  Topography,
} from './schema.ts';
import type { MeshweshSnapshot } from './snapshot.ts';
import {
  armyListKey,
  type SubFactionGroup,
  type SubFactionOverlay,
  subFactionGroupFor,
} from './sub-factions.ts';
import { identityTranslator, type Translator } from './translations.ts';

// The variant ids and the rule keys are the overlay's own wiring, so only the
// label and the names a player reads are translated.
const subFactionGroup = (
  overlay: SubFactionOverlay,
  armyList: { listId: number; sublistId: string },
  translate: Translator,
) => {
  const group = subFactionGroupFor(overlay, armyList);
  return group
    ? {
        ...group,
        label: translate.subFaction(group.label),
        variants: group.variants.map((variant) => ({
          ...variant,
          name: translate.subFaction(variant.name),
        })),
      }
    : null;
};

export const bundlePaths = {
  index: 'index.json',
  troopTypes: 'troop-types.json',
  battleCards: 'battle-cards.json',
  battleCardText: 'battle-card-text.json',
  thematicCategories: 'thematic-categories.json',
  tagWords: 'tag-words.json',
  army: (id: string) => `armies/${id}.json`,
} as const;

export const eagerPayloadBudgetBytes = 150 * 1024;

export type BundleMeta = {
  source: string;
  fetchedAt: string;
  contentHash: string;
};

export type ArmyIndexEntry = {
  id: string;
  key: string;
  name: string;
  extendedName: string;
  status: ArmyListStatus;
  keywords: string[];
  startDate: number;
  endDate: number;
  invasion: number[];
  maneuver: number[];
  topographies: Topography[];
  categories: string[];
};

export type ArmyIndex = {
  meta: BundleMeta;
  armies: ArmyIndexEntry[];
};

export type AllyContingent = {
  id: string;
  name: string;
  internalContingent: boolean;
  dateRange: MeshweshDateRange | null;
  troopOptions: MeshweshTroopOption[];
};

export type ArmyDetail = {
  id: string;
  key: string;
  name: string;
  extendedName: string;
  startDate: number;
  endDate: number;
  showTroopOptionDescriptions: boolean;
  invasionRatings: MeshweshRating[];
  maneuverRatings: MeshweshRating[];
  homeTopographies: MeshweshHomeTopography[];
  troopOptions: MeshweshTroopOption[];
  troopEntriesForGeneral: MeshweshArmyList['troopEntriesForGeneral'];
  battleCardEntries: MeshweshBattleCardEntry[];
  allyOptions: MeshweshAllyOption[];
  allyContingents: AllyContingent[];
  enemies: string[];
  subFactions: SubFactionGroup | null;
};

export type BundledBattleCard = Omit<
  MeshweshBattleCard,
  'id' | 'importName' | 'mdText'
> & {
  purchasedPer: BattleCardPurchaseScope;
  rule: BattleCardCostRule;
};

export type BundledTroopType = Omit<MeshweshTroopType, 'id' | 'importName'> & {
  movement?: number;
  basing?: TroopTypeBasing;
};

export type BattleCardText = Record<BattleCardCode, string>;

export type BundleFile = {
  path: string;
  eager: boolean;
  contents: unknown;
};

const byId = (left: { id: string }, right: { id: string }) =>
  left.id < right.id ? -1 : 1;

const bySortId = (left: MeshweshArmyList, right: MeshweshArmyList) =>
  left.sortId - right.sortId || byId(left, right);

const categoriesByArmyList = (
  thematicCategoryArmyLists: MeshweshThematicCategoryArmyLists,
) => {
  const categories = new Map<string, string[]>();
  for (const [categoryId, armyListIds] of Object.entries(
    thematicCategoryArmyLists,
  ).sort(byKey)) {
    for (const armyListId of armyListIds) {
      const existing = categories.get(armyListId);
      if (existing) {
        existing.push(categoryId);
      } else {
        categories.set(armyListId, [categoryId]);
      }
    }
  }
  return categories;
};

const spanWords = /\b(BC|AD|to)\b/g;

const spans: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: { BC: 'BC', AD: 'AD', to: 'to' },
  es: { BC: 'a.C.', AD: 'd.C.', to: 'a' },
};

const extendedName = (armyList: MeshweshArmyList, translate: Translator) => {
  const upstream = armyList.derivedData.extendedName;
  const name = translate.armyName(armyList.id, armyList.name);
  const tail = upstream.startsWith(armyList.name)
    ? upstream.slice(armyList.name.length)
    : ` ${upstream}`;
  const words = spans[translate.locale] ?? spans.en;
  return `${name}${tail.replace(spanWords, (word) => words?.[word] ?? word)}`;
};

const indexEntry = (
  armyList: MeshweshArmyList,
  categories: readonly string[],
  translate: Translator,
): ArmyIndexEntry => ({
  id: armyList.id,
  key: armyListKey(armyList),
  name: translate.armyName(armyList.id, armyList.name),
  extendedName: extendedName(armyList, translate),
  status: armyList.status,
  keywords: armyList.keywords.map(
    (keyword) => translate.keyword(keyword) ?? keyword,
  ),
  startDate: armyList.derivedData.listStartDate,
  endDate: armyList.derivedData.listEndDate,
  invasion: armyList.invasionRatings.map(({ value }) => value),
  maneuver: armyList.maneuverRatings.map(({ value }) => value),
  topographies: [
    ...new Set(armyList.homeTopographies.flatMap(({ values }) => values)),
  ],
  categories: [...categories],
});

const referencedContingentIds = (
  allyOptions: readonly MeshweshAllyOption[],
) => [
  ...new Set(
    allyOptions.flatMap(({ allyEntries }) =>
      allyEntries.map(({ allyArmyList }) => allyArmyList),
    ),
  ),
];

const troopOptionsWith = (
  troopOptions: MeshweshArmyList['troopOptions'],
  translate: Translator,
) =>
  troopOptions.map((option) => ({
    ...option,
    description:
      translate.troopOption(option.description) ?? option.description,
  }));

const contingent = (
  {
    id,
    name,
    internalContingent,
    dateRange,
    troopOptions,
  }: MeshweshAllyArmyList,
  translate: Translator,
): AllyContingent => ({
  id,
  name: translate.allyName(name) ?? name,
  internalContingent,
  dateRange,
  troopOptions: troopOptionsWith(troopOptions, translate),
});

const armyDetail = (
  armyList: MeshweshArmyList,
  allyArmyLists: ReadonlyMap<string, MeshweshAllyArmyList>,
  enemies: readonly string[],
  overlay: SubFactionOverlay,
  translate: Translator,
): ArmyDetail => ({
  id: armyList.id,
  key: armyListKey(armyList),
  name: translate.armyName(armyList.id, armyList.name),
  extendedName: extendedName(armyList, translate),
  startDate: armyList.derivedData.listStartDate,
  endDate: armyList.derivedData.listEndDate,
  showTroopOptionDescriptions: armyList.showTroopOptionDescriptions,
  invasionRatings: armyList.invasionRatings.map((rating) => ({
    ...rating,
    note: translate.note(rating.note) ?? rating.note,
  })),
  maneuverRatings: armyList.maneuverRatings.map((rating) => ({
    ...rating,
    note: translate.note(rating.note) ?? rating.note,
  })),
  homeTopographies: armyList.homeTopographies.map((topography) => ({
    ...topography,
    note: translate.note(topography.note) ?? topography.note,
  })),
  troopOptions: troopOptionsWith(armyList.troopOptions, translate),
  troopEntriesForGeneral: armyList.troopEntriesForGeneral,
  battleCardEntries: armyList.battleCardEntries.map((entry) => ({
    ...entry,
    note: translate.note(entry.note) ?? entry.note,
  })),
  allyOptions: armyList.allyOptions.map((option) => ({
    ...option,
    allyEntries: option.allyEntries.map((entry) => ({
      ...entry,
      name: translate.allyName(entry.name) ?? entry.name,
    })),
  })),
  allyContingents: referencedContingentIds(armyList.allyOptions).map((id) => {
    const allyArmyList = allyArmyLists.get(id);
    if (!allyArmyList) {
      throw new Error(
        `${armyList.name} references an ally contingent ${id} that is not in the snapshot`,
      );
    }
    return contingent(allyArmyList, translate);
  }),
  enemies: [...enemies],
  subFactions: subFactionGroup(overlay, armyList, translate),
});

const battleCard = (
  {
    permanentCode,
    listName,
    displayName,
    category,
    showInList,
  }: MeshweshBattleCard,
  costs: Curation['battleCardCosts'],
  translate: Translator,
): BundledBattleCard => ({
  permanentCode,
  listName: translate.battleCardListName(permanentCode, listName),
  displayName: translate.battleCardName(permanentCode, displayName),
  category,
  showInList,
  purchasedPer: costs[permanentCode].purchasedPer,
  rule: costs[permanentCode].rule,
});

const troopType = (
  {
    permanentCode,
    displayName,
    displayCode,
    description,
    category,
    order,
    cost,
    combatFactors,
  }: MeshweshTroopType,
  { movement, basing }: Pick<Curation, 'movement' | 'basing'>,
  translate: Translator,
): BundledTroopType => ({
  permanentCode,
  displayName: translate.troopTypeName(permanentCode, displayName),
  displayCode,
  description: translate.troopTypeDescription(permanentCode, description),
  category,
  order,
  cost,
  combatFactors,
  ...optional('movement', movement[permanentCode]),
  ...optional('basing', basing[permanentCode]),
});

const optional = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
) => (value === undefined ? {} : ({ [key]: value } as Record<Key, Value>));

const battleCardText = (
  battleCards: readonly MeshweshBattleCard[],
  translate: Translator,
): BattleCardText =>
  Object.fromEntries(
    [...battleCards]
      .sort((left, right) =>
        left.permanentCode < right.permanentCode ? -1 : 1,
      )
      .map(({ permanentCode, mdText }) => [
        permanentCode,
        translate.battleCardText(permanentCode, mdText),
      ]),
  ) as BattleCardText;

const describedOptions = (details: readonly ArmyDetail[]) => {
  const contingents = new Map(
    details.flatMap(({ allyContingents }) =>
      allyContingents.map((contingent) => [contingent.id, contingent]),
    ),
  );
  return [
    ...details.flatMap(({ troopOptions }) => troopOptions),
    ...[...contingents.values()].flatMap(({ troopOptions }) => troopOptions),
  ].map(({ description, troopEntries }) => ({
    description,
    troopTypes: troopEntries.map(({ troopTypeCode }) => troopTypeCode),
  }));
};

export const buildBundle = (
  snapshot: MeshweshSnapshot,
  curation: Curation,
  translate: Translator = identityTranslator(defaultLocale),
): BundleFile[] => {
  const armyLists = [...snapshot.armyLists].sort(bySortId);
  const allyArmyLists = new Map(
    snapshot.allyArmyLists.map((allyArmyList) => [
      allyArmyList.id,
      allyArmyList,
    ]),
  );
  const categories = categoriesByArmyList(snapshot.thematicCategoryArmyLists);
  const details = armyLists.map((armyList) =>
    armyDetail(
      armyList,
      allyArmyLists,
      snapshot.enemyArmyLists[armyList.id] ?? [],
      curation.subFactions,
      translate,
    ),
  );
  const index: ArmyIndex = {
    meta: {
      source: snapshot.manifest.source,
      fetchedAt: snapshot.manifest.fetchedAt,
      contentHash: snapshot.manifest.contentHash,
    },
    armies: armyLists.map((armyList) =>
      indexEntry(armyList, categories.get(armyList.id) ?? [], translate),
    ),
  };
  return [
    { path: bundlePaths.index, eager: true, contents: index },
    {
      path: bundlePaths.troopTypes,
      eager: false,
      contents: [...snapshot.troopTypes]
        .sort(byId)
        .map((entry) => troopType(entry, curation, translate)),
    },
    {
      path: bundlePaths.battleCards,
      eager: false,
      contents: [...snapshot.battleCards]
        .sort(byId)
        .map((entry) => battleCard(entry, curation.battleCardCosts, translate)),
    },
    {
      path: bundlePaths.battleCardText,
      eager: false,
      contents: battleCardText(snapshot.battleCards, translate),
    },
    {
      path: bundlePaths.thematicCategories,
      eager: false,
      contents: [...snapshot.thematicCategories].sort(byId).map((category) => ({
        ...category,
        name: translate.categoryName(category.id, category.name),
      })),
    },
    {
      path: bundlePaths.tagWords,
      eager: false,
      contents: tagWords(describedOptions(details)),
    },
    ...details.map((detail) => ({
      path: bundlePaths.army(detail.id),
      eager: false,
      contents: detail,
    })),
  ];
};
