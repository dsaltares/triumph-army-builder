import type { BattleCardCode, TroopTypeCode } from '../../data/schema.ts';
import {
  appliedPerStand,
  appliedToPairsOfStands,
  type BattleCardCosts,
} from '../battle-cards/costs.ts';
import type { BattleCardNames } from '../battle-cards/listing.ts';
import { triumphRules } from '../games/triumph-rules.ts';
import { byKey } from '../ordering.ts';
import type { TroopTypeNames } from '../troop-types.ts';
import {
  type ArmyList,
  type BattleCardAllowance,
  type ContingentGroupId,
  type ContingentId,
  findContingent,
  findContingentGroup,
  findTroopOption,
  type TroopOption,
  type TroopOptionId,
} from './army-list.ts';
import { coversYear, resolveArmyList } from './availability.ts';
import { type ArmyPoints, armyPoints, type PointCosts } from './points.ts';
import {
  type ArmySelection,
  type BattleCardCopies,
  battleCardSelections,
  selectedContingents,
  standCount,
  troopOptionStandCount,
} from './selection.ts';

export const findingSeverities = ['error', 'warning', 'info'] as const;

export type FindingSeverity = (typeof findingSeverities)[number];

export type FindingTarget =
  | { kind: 'army' }
  | { kind: 'gating' }
  | { kind: 'general' }
  | { kind: 'contingentGroup'; group: ContingentGroupId }
  | { kind: 'troopOption'; option: TroopOptionId }
  | { kind: 'armyBattleCard'; code: BattleCardCode }
  | { kind: 'troopBattleCard'; code: BattleCardCode; option: TroopOptionId };

export const findingCodes = [
  'overPointsCap',
  'underPointsCap',
  'yearOutsideArmyDateRange',
  'subFactionNotChosen',
  'unknownSubFaction',
  'unknownContingentGroup',
  'contingentGroupUnavailable',
  'multipleAllyTroopOptions',
  'troopOptionBelowMin',
  'troopOptionAboveMax',
  'troopOptionMixedTypes',
  'troopOptionUnavailable',
  'contingentNotTaken',
  'unknownTroopOption',
  'generalMissing',
  'generalStandMissing',
  'generalFromAlliedContingent',
  'generalTroopTypeNotAllowed',
  'battleCardUnavailable',
  'battleCardAboveMax',
  'battleCardBelowMin',
  'battleCardStandsExceedOption',
  'battleCardPurchaseLimit',
  'battleCardNeedsPairsOfStands',
  'battleCardForbidsTroopType',
] as const;

export type FindingCode = (typeof findingCodes)[number];

export type BattleCardUnit = 'copies' | 'stands';

export type FindingParams = {
  overPointsCap: { total: number; over: number; cap: number };
  underPointsCap: { total: number; unspent: number; cap: number };
  yearOutsideArmyDateRange: {
    army: string;
    from: number;
    to: number;
    year: number;
  };
  subFactionNotChosen: { question: string };
  unknownSubFaction: { variant: string; army: string };
  unknownContingentGroup: { army: string };
  contingentGroupUnavailable: { group: string; year: number };
  multipleAllyTroopOptions: { selected: number };
  troopOptionBelowMin: { option: string; min: number; taken: number };
  troopOptionAboveMax: { option: string; max: number; taken: number };
  troopOptionMixedTypes: { option: string; troopTypes: readonly string[] };
  unknownTroopOption: { army: string };
  troopOptionUnavailable: { option: string };
  contingentNotTaken: { option: string };
  generalMissing: Record<never, never>;
  generalStandMissing: { troopType: string };
  generalFromAlliedContingent: { contingent: string };
  generalTroopTypeNotAllowed: { allowed: string; chosen: string };
  battleCardUnavailable: { card: string; subject: string };
  battleCardAboveMax: {
    card: string;
    subject: string;
    unit: BattleCardUnit;
    max: number;
    selected: number;
  };
  battleCardBelowMin: {
    card: string;
    subject: string;
    unit: BattleCardUnit;
    min: number;
    selected: number;
  };
  battleCardNeedsPairsOfStands: {
    card: string;
    option: string;
    applied: number;
  };
  battleCardStandsExceedOption: {
    card: string;
    option: string;
    applied: number;
    taken: number;
    perStand: boolean;
  };
  battleCardPurchaseLimit: { card: string; limit: number; purchases: number };
  battleCardForbidsTroopType: { card: string; troopType: string };
};

export type Finding = {
  [Code in FindingCode]: {
    code: Code;
    severity: FindingSeverity;
    target: FindingTarget;
    params: FindingParams[Code];
  };
}[FindingCode];

export type ValidationRules = {
  pointsCap: number;
};

export const battleCardPurchaseLimits: Readonly<
  Partial<Record<BattleCardCode, number>>
> = { HL: 3 };

export const battleCardForbiddenTroopTypes: Readonly<
  Partial<Record<BattleCardCode, TroopTypeCode>>
> = { ES: 'ELE' };

const severityOf: Record<FindingCode, FindingSeverity> = {
  overPointsCap: 'error',
  underPointsCap: 'warning',
  yearOutsideArmyDateRange: 'error',
  subFactionNotChosen: 'warning',
  unknownSubFaction: 'warning',
  unknownContingentGroup: 'warning',
  contingentGroupUnavailable: 'error',
  multipleAllyTroopOptions: 'error',
  troopOptionBelowMin: 'error',
  troopOptionAboveMax: 'error',
  troopOptionMixedTypes: 'error',
  troopOptionUnavailable: 'error',
  contingentNotTaken: 'info',
  unknownTroopOption: 'warning',
  generalMissing: 'error',
  generalStandMissing: 'error',
  generalFromAlliedContingent: 'error',
  generalTroopTypeNotAllowed: 'error',
  battleCardUnavailable: 'error',
  battleCardAboveMax: 'error',
  battleCardBelowMin: 'error',
  battleCardStandsExceedOption: 'error',
  battleCardPurchaseLimit: 'error',
  battleCardNeedsPairsOfStands: 'error',
  battleCardForbidsTroopType: 'error',
};

const finding = <Code extends FindingCode>(
  code: Code,
  target: FindingTarget,
  params: FindingParams[Code],
): Finding => ({ code, severity: severityOf[code], target, params }) as Finding;

type CardNames = Readonly<Record<BattleCardCode, string>>;

const namedCards = (
  cardNames: BattleCardNames,
  costs: BattleCardCosts,
): CardNames =>
  Object.fromEntries(
    Object.entries(costs).map(([code, { name }]) => [
      code,
      cardNames[code as BattleCardCode] ?? name,
    ]),
  ) as CardNames;

const troopOptionLabel = (
  { troopEntries }: TroopOption,
  names: TroopTypeNames,
) => troopEntries.map(({ troopType }) => names[troopType]).join(' or ');

const pointsFindings = (
  { total }: ArmyPoints,
  { pointsCap }: ValidationRules,
): readonly Finding[] => {
  const target = { kind: 'army' } as const;
  if (total > pointsCap) {
    return [
      finding('overPointsCap', target, {
        total,
        over: total - pointsCap,
        cap: pointsCap,
      }),
    ];
  }
  if (total < pointsCap) {
    return [
      finding('underPointsCap', target, {
        total,
        unspent: pointsCap - total,
        cap: pointsCap,
      }),
    ];
  }
  return [];
};

const gatingFindings = (
  armyList: ArmyList,
  { year, variant }: ArmySelection,
): readonly Finding[] => {
  const target = { kind: 'gating' } as const;
  const { subFactions, dateRange } = armyList;
  const declared =
    subFactions?.variants.some(({ id }) => id === variant) ?? false;
  return [
    ...(coversYear([dateRange], year)
      ? []
      : [
          finding('yearOutsideArmyDateRange', target, {
            army: armyList.name,
            from: dateRange.startDate,
            to: dateRange.endDate,
            year,
          }),
        ]),
    ...(subFactions && variant === null
      ? [
          finding('subFactionNotChosen', target, {
            question: subFactions.label,
          }),
        ]
      : []),
    ...(variant !== null && !declared
      ? [finding('unknownSubFaction', target, { variant, army: armyList.name })]
      : []),
  ];
};

const selectedGroups = (armyList: ArmyList, selection: ArmySelection) =>
  selection.contingentGroups.map((id) => ({
    id,
    group: findContingentGroup(armyList, id),
  }));

const contingentGroupFindings = (
  armyList: ArmyList,
  available: ReadonlySet<ContingentGroupId>,
  selection: ArmySelection,
): readonly Finding[] => {
  const groups = selectedGroups(armyList, selection);
  const allies = groups.filter(
    ({ group }) => group?.kind === 'allyTroopOption',
  );
  return groups.flatMap(({ id, group }) => {
    const target = { kind: 'contingentGroup', group: id } as const;
    if (!group) {
      return [
        finding('unknownContingentGroup', target, { army: armyList.name }),
      ];
    }
    if (!available.has(id)) {
      return [
        finding('contingentGroupUnavailable', target, {
          group: group.name,
          year: selection.year,
        }),
      ];
    }
    return group.kind === 'allyTroopOption' && allies.length > 1
      ? [
          finding('multipleAllyTroopOptions', target, {
            selected: allies.length,
          }),
        ]
      : [];
  });
};

const troopOptionFindings = (
  option: TroopOption,
  selection: ArmySelection,
  names: TroopTypeNames,
): readonly Finding[] => {
  const target = { kind: 'troopOption', option: option.id } as const;
  const taken = troopOptionStandCount(selection, option.id);
  const troopTypes = option.troopEntries
    .map(({ troopType }) => troopType)
    .filter((troopType) => standCount(selection, option.id, troopType) > 0)
    .map((troopType) => names[troopType]);
  const label = troopOptionLabel(option, names);
  return [
    ...(taken < option.min
      ? [
          finding('troopOptionBelowMin', target, {
            option: label,
            min: option.min,
            taken,
          }),
        ]
      : []),
    ...(taken > option.max
      ? [
          finding('troopOptionAboveMax', target, {
            option: label,
            max: option.max,
            taken,
          }),
        ]
      : []),
    ...(option.mix === 'singleType' && troopTypes.length > 1
      ? [
          finding('troopOptionMixedTypes', target, {
            option: label,
            troopTypes,
          }),
        ]
      : []),
  ];
};

const referencedTroopOptions = (
  selection: ArmySelection,
): readonly TroopOptionId[] =>
  [
    ...new Set([
      ...Object.keys(selection.stands),
      ...Object.keys(selection.troopBattleCards),
    ]),
  ]
    .sort()
    .map((option) => option as TroopOptionId)
    .filter(
      (option) =>
        troopOptionStandCount(selection, option) > 0 ||
        selectedCards(selection.troopBattleCards[option] ?? {}).length > 0,
    );

const groupsHolding = (armyList: ArmyList, contingent: ContingentId) =>
  armyList.contingentGroups.filter(({ contingents }) =>
    contingents.some(({ id }) => id === contingent),
  );

const danglingTroopOptionFinding = (
  armyList: ArmyList,
  available: ReadonlySet<ContingentGroupId>,
  selection: ArmySelection,
  names: TroopTypeNames,
  id: TroopOptionId,
): readonly Finding[] => {
  const target = { kind: 'troopOption', option: id } as const;
  const option = findTroopOption(armyList, id);
  if (!option) {
    return [finding('unknownTroopOption', target, { army: armyList.name })];
  }
  const unavailable = finding('troopOptionUnavailable', target, {
    option: troopOptionLabel(option, names),
  });
  const groups = groupsHolding(armyList, option.contingent);
  if (groups.length === 0) {
    return [unavailable];
  }
  const taken = groups.filter(({ id: group }) =>
    selection.contingentGroups.includes(group),
  );
  if (taken.length === 0) {
    return [
      finding('contingentNotTaken', target, {
        option: troopOptionLabel(option, names),
      }),
    ];
  }
  return taken.some(({ id: group }) => available.has(group))
    ? [unavailable]
    : [];
};

const generalTroopTypeNames = (
  { generalTroopTypes }: ArmyList,
  names: TroopTypeNames,
) => generalTroopTypes.map((troopType) => names[troopType]).join(' or ');

const generalFindings = (
  armyList: ArmyList,
  active: ReadonlyMap<TroopOptionId, TroopOption>,
  selection: ArmySelection,
  names: TroopTypeNames,
): readonly Finding[] => {
  const target = { kind: 'general' } as const;
  const { general } = selection;
  if (!general) {
    return [finding('generalMissing', target, {})];
  }
  const option = active.get(general.option);
  if (
    !option ||
    standCount(selection, general.option, general.troopType) === 0
  ) {
    return [
      finding('generalStandMissing', target, {
        troopType: names[general.troopType] ?? general.troopType,
      }),
    ];
  }
  const contingent = findContingent(armyList, option.contingent);
  return [
    ...(contingent?.kind === 'allied'
      ? [
          finding('generalFromAlliedContingent', target, {
            contingent: contingent.name,
          }),
        ]
      : []),
    ...(armyList.generalTroopTypes.includes(general.troopType)
      ? []
      : [
          finding('generalTroopTypeNotAllowed', target, {
            allowed: generalTroopTypeNames(armyList, names),
            chosen: names[general.troopType] ?? general.troopType,
          }),
        ]),
  ];
};

const selectedCards = (
  selected: BattleCardCopies,
): readonly (readonly [BattleCardCode, number])[] =>
  Object.entries(selected)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => [code as BattleCardCode, count] as const)
    .sort(byKey);

type BattleCardScope = {
  allowances: readonly BattleCardAllowance[];
  selected: BattleCardCopies;
  subject: string;
  unit: BattleCardUnit;
  cardNames: CardNames;
  targetOf: (code: BattleCardCode) => FindingTarget;
};

const battleCardScopeFindings = ({
  allowances,
  selected,
  subject,
  unit,
  cardNames,
  targetOf,
}: BattleCardScope): readonly Finding[] => {
  const allowed = new Map(
    allowances.map((allowance) => [allowance.code, allowance]),
  );
  return [
    ...selectedCards(selected).flatMap(([code, count]) => {
      const allowance = allowed.get(code);
      if (!allowance) {
        return [
          finding('battleCardUnavailable', targetOf(code), {
            card: cardNames[code],
            subject,
          }),
        ];
      }
      return allowance.max !== null && count > allowance.max
        ? [
            finding('battleCardAboveMax', targetOf(code), {
              card: cardNames[code],
              subject,
              unit,
              max: allowance.max,
              selected: count,
            }),
          ]
        : [];
    }),
    ...allowances.flatMap(({ code, min }) => {
      const count = selected[code] ?? 0;
      return min !== null && count < min
        ? [
            finding('battleCardBelowMin', targetOf(code), {
              card: cardNames[code],
              subject,
              unit,
              min,
              selected: count,
            }),
          ]
        : [];
    }),
  ];
};

const armyBattleCardFindings = (
  armyList: ArmyList,
  selection: ArmySelection,
  cardNames: CardNames,
): readonly Finding[] =>
  battleCardScopeFindings({
    allowances: armyList.battleCards,
    selected: selection.armyBattleCards,
    subject: armyList.name,
    unit: 'copies',
    cardNames,
    targetOf: (code) => ({ kind: 'armyBattleCard', code }),
  });

const troopBattleCardFindings = (
  option: TroopOption,
  selection: ArmySelection,
  names: TroopTypeNames,
  cardNames: CardNames,
  costs: BattleCardCosts,
): readonly Finding[] => {
  const selected = selection.troopBattleCards[option.id] ?? {};
  const taken = troopOptionStandCount(selection, option.id);
  const label = troopOptionLabel(option, names);
  const targetOf = (code: BattleCardCode) =>
    ({ kind: 'troopBattleCard', code, option: option.id }) as const;
  return [
    ...battleCardScopeFindings({
      allowances: option.battleCards,
      selected,
      subject: label,
      unit: 'stands',
      cardNames,
      targetOf,
    }),
    ...selectedCards(selected).flatMap(([code, applied]) =>
      appliedToPairsOfStands(code) && applied % 2 !== 0
        ? [
            finding('battleCardNeedsPairsOfStands', targetOf(code), {
              card: cardNames[code],
              option: label,
              applied,
            }),
          ]
        : [],
    ),
    ...selectedCards(selected).flatMap(([code, applied]) =>
      applied > taken
        ? [
            finding('battleCardStandsExceedOption', targetOf(code), {
              card: cardNames[code],
              option: label,
              applied,
              taken,
              perStand: appliedPerStand(costs, code),
            }),
          ]
        : [],
    ),
  ];
};

const purchaseLimitFindings = (
  { battleCardLines }: ArmyPoints,
  cardNames: CardNames,
): readonly Finding[] =>
  battleCardLines.flatMap(({ code, purchases, options }) => {
    const limit = battleCardPurchaseLimits[code];
    if (limit === undefined || purchases <= limit) {
      return [];
    }
    const params = { card: cardNames[code], limit, purchases };
    return options.length > 0
      ? options.map((option) =>
          finding(
            'battleCardPurchaseLimit',
            { kind: 'troopBattleCard', code, option },
            params,
          ),
        )
      : [
          finding(
            'battleCardPurchaseLimit',
            { kind: 'armyBattleCard', code },
            params,
          ),
        ];
  });

const forbiddenTroopTypeFindings = (
  { standLines }: ArmyPoints,
  selection: ArmySelection,
  names: TroopTypeNames,
  cardNames: CardNames,
): readonly Finding[] => {
  const taken = new Map(
    battleCardSelections(selection)
      .filter((entry) =>
        entry.scope === 'army' ? entry.copies > 0 : entry.stands > 0,
      )
      .map((entry) => [
        entry.code,
        entry.scope === 'army'
          ? ({ kind: 'armyBattleCard', code: entry.code } as const)
          : ({
              kind: 'troopBattleCard',
              code: entry.code,
              option: entry.option,
            } as const),
      ]),
  );
  return [...taken].flatMap(([code, target]) => {
    const forbidden = battleCardForbiddenTroopTypes[code];
    if (
      !forbidden ||
      !standLines.some((line) => line.troopType === forbidden)
    ) {
      return [];
    }
    return [
      finding('battleCardForbidsTroopType', target, {
        card: cardNames[code],
        troopType: names[forbidden] ?? forbidden,
      }),
    ];
  });
};

export const validateArmy = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  names: TroopTypeNames,
  rules: ValidationRules = triumphRules,
  cardNames: BattleCardNames = {},
): readonly Finding[] => {
  const resolved = resolveArmyList(armyList, {
    year: selection.year,
    variant: selection.variant,
  });
  const available = new Set(resolved.contingentGroups.map(({ id }) => id));
  const activeOptions = selectedContingents(resolved, selection).flatMap(
    ({ troopOptions }) => troopOptions,
  );
  const active = new Map(activeOptions.map((option) => [option.id, option]));
  const points = armyPoints(armyList, selection, costs);
  const named = namedCards(cardNames, costs.battleCards);
  return [
    ...pointsFindings(points, rules),
    ...gatingFindings(armyList, selection),
    ...contingentGroupFindings(armyList, available, selection),
    ...activeOptions.flatMap((option) =>
      troopOptionFindings(option, selection, names),
    ),
    ...referencedTroopOptions(selection)
      .filter((id) => !active.has(id))
      .flatMap((id) =>
        danglingTroopOptionFinding(armyList, available, selection, names, id),
      ),
    ...generalFindings(armyList, active, selection, names),
    ...armyBattleCardFindings(armyList, selection, named),
    ...activeOptions.flatMap((option) =>
      troopBattleCardFindings(
        option,
        selection,
        names,
        named,
        costs.battleCards,
      ),
    ),
    ...purchaseLimitFindings(points, named),
    ...forbiddenTroopTypeFindings(points, selection, names, named),
  ];
};

export const isLegal = (findings: readonly Finding[]) =>
  !findings.some(({ severity }) => severity === 'error');
