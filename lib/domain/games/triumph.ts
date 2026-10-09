import { type PointsMeter, pointsMeter } from '../army/builder.ts';
import { canonicalSelection } from '../army/canonical-selection.ts';
import { armyPoints, pointCosts } from '../army/points.ts';
import { defaultListName } from '../army/saved-army.ts';
import type { ArmySelection } from '../army/selection.ts';
import { selectionSchema } from '../army/selection-schema.ts';
import type { ListViewData } from '../army/shared-view.ts';
import { type ArmySheet, armySheet } from '../army/sheet.ts';
import type { ValidationRules } from '../army/validation.ts';
import {
  type ValidationReport,
  validationReport,
} from '../army/validation-report.ts';
import { battleCardNames } from '../battle-cards/listing.ts';
import type { GameModule } from '../game.ts';
import {
  troopTypeFactors,
  troopTypeMovements,
  troopTypeNames,
} from '../troop-types.ts';
import { triumphRules } from './triumph-rules.ts';

export type TriumphReference = ListViewData;

const costsOf = ({ troopTypes, battleCards }: TriumphReference) =>
  pointCosts(troopTypes, battleCards);

export const triumph = {
  game: 'triumph',
  rules: triumphRules,
  selectionSchema,
  armyListId: (selection) => selection.army,
  canonicalise: canonicalSelection,
  points: (selection, reference) =>
    pointsMeter(
      armyPoints(reference.armyList, selection, costsOf(reference)),
      triumphRules,
    ),
  validate: (selection, reference) =>
    validationReport(
      reference.armyList,
      selection,
      costsOf(reference),
      troopTypeNames(reference.troopTypes),
      triumphRules,
    ),
  sheetData: ({ name, selection }, reference) =>
    armySheet({
      listName: name,
      armyList: reference.armyList,
      selection,
      costs: costsOf(reference),
      names: troopTypeNames(reference.troopTypes),
      factors: troopTypeFactors(reference.troopTypes),
      movement: troopTypeMovements(reference.troopTypes),
      cardNames: battleCardNames(reference.battleCards),
    }),
  subjectName: ({ armyList }) => armyList.name,
  listTitle: ({ armyList }, at) => defaultListName(armyList.name, at),
} satisfies GameModule<
  ArmySelection,
  TriumphReference,
  ArmySheet,
  PointsMeter,
  ValidationReport
> & { rules: ValidationRules };
