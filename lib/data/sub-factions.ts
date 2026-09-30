import type {
  MeshweshAllyArmyList,
  MeshweshArmyList,
  MeshweshTroopOption,
} from './schema.ts';

export type SubFactionVariant = { id: string; name: string; year?: number };

export type SubFactionClause<Id extends string = string> =
  | Id
  | { variant: Id; from?: number; to?: number };

export type SubFactionRule<Id extends string = string> =
  | { only: readonly SubFactionClause<Id>[] }
  | { except: readonly Id[] };

export type SubFactionGroup = {
  army: string;
  label: string;
  variants: readonly SubFactionVariant[];
  rules: Readonly<Record<string, SubFactionRule>>;
};

export type SubFactionOverlay = Readonly<Record<string, SubFactionGroup>>;

export const armyListKey = ({
  listId,
  sublistId,
}: {
  listId: number;
  sublistId: string;
}) => `${listId}${sublistId}`;

export const subFactionGroupFor = (
  overlay: SubFactionOverlay,
  armyList: { listId: number; sublistId: string },
) => overlay[armyListKey(armyList)] ?? null;

const notesOf = ({
  troopOptions,
}: {
  troopOptions: readonly MeshweshTroopOption[];
}) =>
  new Set(troopOptions.map(({ note }) => note).filter((note) => note !== ''));

const misdated = (
  key: string,
  group: SubFactionGroup,
  { derivedData }: MeshweshArmyList,
) => {
  const { listStartDate, listEndDate } = derivedData;
  return group.variants
    .filter(
      ({ year }) =>
        year !== undefined && (year < listStartDate || year > listEndDate),
    )
    .map(
      ({ name, year }) =>
        `${key} ${group.army} dates ${name} to ${year}, outside its ${listStartDate} to ${listEndDate} span`,
    );
};

const armyProblems = (
  overlay: SubFactionOverlay,
  armyList: MeshweshArmyList,
) => {
  const key = armyListKey(armyList);
  const notes = notesOf(armyList);
  const group = overlay[key];
  if (!group) {
    return notes.size === 0
      ? []
      : [
          `${key} ${armyList.name} has ${notes.size} sub-faction notes and no curated variants`,
        ];
  }
  const named =
    group.army === armyList.name
      ? []
      : [
          `${key} is curated as ${group.army} but upstream now calls it ${armyList.name}`,
        ];
  const uncurated = [...notes]
    .filter((note) => !group.rules[note])
    .map((note) => `${key} ${group.army} has no rule for "${note}"`);
  const stale = Object.keys(group.rules)
    .filter((note) => !notes.has(note))
    .map(
      (note) =>
        `${key} ${group.army} has a rule for "${note}", which upstream no longer uses`,
    );
  return [...named, ...uncurated, ...stale, ...misdated(key, group, armyList)];
};

const allyProblems = (
  overlay: SubFactionOverlay,
  allyArmyList: MeshweshAllyArmyList,
  armyListsById: ReadonlyMap<string, MeshweshArmyList>,
) => {
  const notes = notesOf(allyArmyList);
  if (notes.size === 0) {
    return [];
  }
  const parent = allyArmyList.armyListId
    ? armyListsById.get(allyArmyList.armyListId)
    : undefined;
  if (!parent) {
    return [
      `ally list ${allyArmyList.listId}${allyArmyList.sublistId} ${allyArmyList.name} has sub-faction notes and no parent army list`,
    ];
  }
  const group = subFactionGroupFor(overlay, parent);
  return [...notes]
    .filter((note) => !group?.rules[note])
    .map(
      (note) =>
        `ally list ${allyArmyList.listId}${allyArmyList.sublistId} ${allyArmyList.name} has no rule for "${note}" under ${parent.name}`,
    );
};

const orphanedGroups = (
  overlay: SubFactionOverlay,
  armyLists: readonly MeshweshArmyList[],
) => {
  const keys = new Set(armyLists.map(armyListKey));
  return Object.entries(overlay)
    .filter(([key]) => !keys.has(key))
    .map(
      ([key, group]) =>
        `${key} ${group.army} is curated but no longer exists upstream`,
    );
};

export const subFactionProblems = (
  overlay: SubFactionOverlay,
  {
    armyLists,
    allyArmyLists,
  }: {
    armyLists: readonly MeshweshArmyList[];
    allyArmyLists: readonly MeshweshAllyArmyList[];
  },
) => {
  const armyListsById = new Map(armyLists.map((army) => [army.id, army]));
  return [
    ...armyLists.flatMap((armyList) => armyProblems(overlay, armyList)),
    ...allyArmyLists.flatMap((ally) =>
      allyProblems(overlay, ally, armyListsById),
    ),
    ...orphanedGroups(overlay, armyLists),
  ];
};
