import type { TroopTypeCode } from '../../data/schema.ts';
import { sum } from '../numbers.ts';
import type {
  ArmyList,
  Contingent,
  NonEmpty,
  TroopOption,
} from './army-list.ts';
import {
  type ArmySelection,
  isGeneral,
  selectedContingents,
  standCount,
} from './selection.ts';

export type GeneralExclusion = 'troopType' | 'alliedContingent';

export type GeneralCandidate = {
  contingent: Contingent;
  option: TroopOption;
  troopType: TroopTypeCode;
  stands: number;
  chosen: boolean;
  excludedBy: GeneralExclusion | null;
};

export type GeneralChoice = {
  troopTypes: NonEmpty<TroopTypeCode>;
  candidates: readonly GeneralCandidate[];
  chosen: GeneralCandidate | null;
  eligible: number;
  stands: number;
};

const exclusionOf = (
  contingent: Contingent,
  troopType: TroopTypeCode,
  eligible: ReadonlySet<TroopTypeCode>,
): GeneralExclusion | null => {
  if (contingent.kind === 'allied') {
    return 'alliedContingent';
  }
  return eligible.has(troopType) ? null : 'troopType';
};

const standingCandidates = (
  armyList: ArmyList,
  selection: ArmySelection,
): readonly GeneralCandidate[] => {
  const eligible = new Set(armyList.generalTroopTypes);
  return selectedContingents(armyList, selection).flatMap((contingent) =>
    contingent.troopOptions.flatMap((option) =>
      option.troopEntries.flatMap(({ troopType }) => {
        const stands = standCount(selection, option.id, troopType);
        return stands === 0
          ? []
          : [
              {
                contingent,
                option,
                troopType,
                stands,
                chosen: isGeneral(selection, option.id, troopType),
                excludedBy: exclusionOf(contingent, troopType, eligible),
              },
            ];
      }),
    ),
  );
};

export const generalChoice = (
  armyList: ArmyList,
  selection: ArmySelection,
): GeneralChoice => {
  const standing = standingCandidates(armyList, selection);
  const candidates = standing.filter(
    ({ excludedBy, chosen }) => excludedBy === null || chosen,
  );
  return {
    troopTypes: armyList.generalTroopTypes,
    candidates,
    chosen: candidates.find(({ chosen }) => chosen) ?? null,
    eligible: sum(
      standing
        .filter(({ excludedBy }) => excludedBy === null)
        .map(({ stands }) => stands),
    ),
    stands: sum(standing.map(({ stands }) => stands)),
  };
};
