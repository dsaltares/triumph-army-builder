import { byKey } from '../ordering.ts';
import type { TroopOptionId } from './army-list.ts';
import type { ArmySelection } from './selection.ts';

const counts = <Code extends string>(
  entries: Readonly<Partial<Record<Code, number>>>,
) =>
  Object.fromEntries(
    Object.entries(entries)
      .filter(([, count]) => typeof count === 'number' && count > 0)
      .sort(byKey),
  ) as Readonly<Partial<Record<Code, number>>>;

const countsByOption = <Code extends string>(
  entries: Readonly<
    Record<TroopOptionId, Readonly<Partial<Record<Code, number>>>>
  >,
) =>
  Object.fromEntries(
    Object.entries(entries)
      .map(([option, entry]) => [option, counts(entry)] as const)
      .filter(([, entry]) => Object.keys(entry).length > 0)
      .sort(byKey),
  ) as Readonly<Record<TroopOptionId, Readonly<Partial<Record<Code, number>>>>>;

export const canonicalSelection = (
  selection: ArmySelection,
): ArmySelection => ({
  army: selection.army,
  dataVersion: selection.dataVersion,
  year: selection.year,
  variant: selection.variant,
  contingentGroups: selection.contingentGroups,
  stands: countsByOption(selection.stands),
  general: selection.general && {
    option: selection.general.option,
    troopType: selection.general.troopType,
  },
  armyBattleCards: counts(selection.armyBattleCards),
  troopBattleCards: countsByOption(selection.troopBattleCards),
});
