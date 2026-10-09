import { type PointsMeter, pointsMeter } from '../army/builder.ts';
import { defaultListName } from '../army/saved-army.ts';
import { fantasyPoints } from '../fantasy/points.ts';
import {
  type FantasyReference,
  fantasyCatalogue,
} from '../fantasy/reference.ts';
import {
  type FantasySelection,
  fantasySelectionSchema,
} from '../fantasy/selection-schema.ts';
import { canonicalFantasySelection } from '../fantasy/share.ts';
import { type FantasySheet, fantasySheet } from '../fantasy/sheet-data.ts';
import {
  type FantasyValidationReport,
  fantasyValidationReport,
} from '../fantasy/validation.ts';
import type { GameModule } from '../game.ts';

export type FantasyPointsMeter = PointsMeter & { victoryValue: number };

export const fantasyGameName = 'Fantasy Triumph';

export const fantasy = {
  game: 'fantasy',
  selectionSchema: fantasySelectionSchema,
  armyListId: (_selection) => null,
  canonicalise: canonicalFantasySelection,
  points: (selection, reference) => {
    const points = fantasyPoints(selection, fantasyCatalogue(reference));
    return {
      ...pointsMeter(
        {
          total: points.total,
          standPoints: points.victoryValue,
          allyStandPoints: 0,
          battleCardPoints: points.linePoints,
        },
        { pointsCap: selection.format.pointsTotal },
      ),
      victoryValue: points.victoryValue,
    };
  },
  validate: (selection, reference) =>
    fantasyValidationReport(selection, fantasyCatalogue(reference)),
  sheetData: fantasySheet,
  listTitle: (_reference, at) => defaultListName(fantasyGameName, at),
} satisfies GameModule<
  FantasySelection,
  FantasyReference,
  FantasySheet,
  FantasyPointsMeter,
  FantasyValidationReport
>;
