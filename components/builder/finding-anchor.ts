import type { BattleCardChoices } from '@/lib/domain/army/battle-card-selection';
import type { ContingentSection } from '@/lib/domain/army/contingent-selection';
import type {
  RequiredTroops,
  TroopOptionSelection,
} from '@/lib/domain/army/troop-selection';
import type { FindingTarget } from '@/lib/domain/army/validation';

export const findingAnchorClass = 'scroll-mt-36';

export const validationAnchor = 'validation';

const safe = (id: string) => id.replace(/\W/g, '-');

export const findingAnchor = (target: FindingTarget): string => {
  switch (target.kind) {
    case 'army':
      return 'points';
    case 'gating':
      return 'gating';
    case 'general':
      return 'general';
    case 'contingentGroup':
      return `contingent-${safe(target.group)}`;
    case 'troopOption':
      return `troops-${safe(target.option)}`;
    case 'armyBattleCard':
      return `card-army-${safe(target.code)}`;
    case 'troopBattleCard':
      return `card-${safe(target.option)}-${safe(target.code)}`;
  }
};

export type BuilderSections = {
  troops: RequiredTroops;
  contingents: ContingentSection;
  allies: ContingentSection;
  cards: BattleCardChoices;
};

const troopOptionAnchors = (options: readonly TroopOptionSelection[]) =>
  options.map(({ option }) =>
    findingAnchor({ kind: 'troopOption', option: option.id }),
  );

const contingentAnchors = ({ groups }: ContingentSection) =>
  groups.flatMap(({ group, taken, contingents }) => [
    findingAnchor({ kind: 'contingentGroup', group: group.id }),
    ...(taken
      ? contingents.flatMap(({ options }) => troopOptionAnchors(options))
      : []),
  ]);

const battleCardAnchors = ({ army, troopOptions }: BattleCardChoices) => [
  ...army.map(({ code }) => findingAnchor({ kind: 'armyBattleCard', code })),
  ...troopOptions.flatMap(({ option, choices }) =>
    choices.map(({ code }) =>
      findingAnchor({ kind: 'troopBattleCard', code, option: option.id }),
    ),
  ),
];

export const builderAnchors = ({
  troops,
  contingents,
  allies,
  cards,
}: BuilderSections): ReadonlySet<string> =>
  new Set([
    findingAnchor({ kind: 'army' }),
    findingAnchor({ kind: 'gating' }),
    findingAnchor({ kind: 'general' }),
    ...troopOptionAnchors(troops.options),
    ...contingentAnchors(contingents),
    ...contingentAnchors(allies),
    ...battleCardAnchors(cards),
  ]);
