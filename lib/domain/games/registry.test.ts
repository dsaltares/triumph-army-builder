import { beforeAll, describe, expect, it } from 'vitest';
import { readArmyListReference } from '@/lib/data/game-reference';
import { sampleBundleHolding } from '@/test/bundle-source.ts';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army.ts';
import {
  cards,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import { pointsMeter } from '../army/builder.ts';
import { canonicalSelection } from '../army/canonical-selection.ts';
import { armyPoints, pointCosts } from '../army/points.ts';
import { defaultListName } from '../army/saved-army.ts';
import { selectionSchema } from '../army/selection-schema.ts';
import { validationReport } from '../army/validation-report.ts';
import {
  type FantasyReference,
  fantasyCatalogue,
} from '../fantasy/reference.ts';
import { canonicalFantasySelection } from '../fantasy/share.ts';
import { fantasySheet } from '../fantasy/sheet-data.ts';
import { fantasyValidationReport } from '../fantasy/validation.ts';
import { games } from '../game.ts';
import { troopTypeNames } from '../troop-types.ts';
import { gameModule } from './registry.ts';
import type { TriumphReference } from './triumph.ts';

let reference: TriumphReference;

beforeAll(async () => {
  const data = await readArmyListReference(
    await sampleBundleHolding(armyDetail()),
    armyDetail().id,
  );
  if (!data) {
    throw new Error('the fixture army did not load');
  }
  reference = data;
});

describe('the game registry', () => {
  it('holds a module for every game, under its own name', () => {
    for (const game of games) {
      expect(gameModule(game).game).toBe(game);
    }
  });
});

describe('the Triumph! module', () => {
  const triumph = gameModule('triumph');

  it('builds lists to 48 points', () => {
    expect(triumph.rules).toEqual({ pointsCap: 48 });
  });

  it('reads and writes the selection the share codec always has', () => {
    expect(triumph.selectionSchema).toBe(selectionSchema);
    expect(triumph.canonicalise).toBe(canonicalSelection);
  });

  it('files a list under the army list it was built from', () => {
    expect(triumph.armyListId(fixtureSelection())).toBe(armyDetail().id);
  });

  it('adds up and validates a list the way the builder does', () => {
    const selection = fixtureSelection();
    const costs = pointCosts(reference.troopTypes, reference.battleCards);

    expect(triumph.points(selection, reference)).toEqual(
      pointsMeter(armyPoints(reference.armyList, selection, costs)),
    );
    expect(triumph.validate(selection, reference)).toEqual(
      validationReport(
        reference.armyList,
        selection,
        costs,
        troopTypeNames(reference.troopTypes),
      ),
    );
  });

  it('puts the list name on its sheet', () => {
    expect(
      triumph.sheetData(
        { name: 'Cannae', selection: fixtureSelection() },
        reference,
      ),
    ).toMatchObject({ listName: 'Cannae', armyId: armyDetail().id });
  });

  it('says what a list is of by the army list it was built from', () => {
    expect(triumph.subjectName(reference)).toBe(reference.armyList.name);
  });

  it('names a new list after its army and the day it was started', () => {
    const at = new Date('2026-09-20T10:00:00.000Z');

    expect(triumph.listTitle(reference, at)).toBe(
      defaultListName(reference.armyList.name, at),
    );
  });
});

describe('the Fantasy Triumph module', () => {
  const fantasy = gameModule('fantasy');
  let fantasyReference: FantasyReference;

  beforeAll(async () => {
    fantasyReference = await sampleFantasyReference();
  });

  const list = fantasySelection({
    units: [
      fantasyUnit('spears', 'SPR', { stands: 8 }),
      fantasyUnit('dragon', 'ELE', {
        cards: cards('deadly', 'armored'),
        marks: { delayedEntry: 1 },
      }),
    ],
    general: 'spears',
  });

  it('files a list under no army list and reads its own selection', () => {
    expect(fantasy.armyListId(list)).toBeNull();
    expect(fantasy.selectionSchema.parse(list)).toEqual(list);
    expect(fantasy.canonicalise(list)).toEqual(canonicalFantasySelection(list));
  });

  it('meters the total against the list’s own points total, with the victory value beside it', () => {
    expect(fantasy.points(list, fantasyReference)).toEqual({
      total: 36.5,
      cap: 51,
      remaining: 14.5,
      status: 'under',
      standPoints: 38.5,
      allyStandPoints: 0,
      battleCardPoints: -2,
      filled: 36.5 / 51,
      victoryValue: 38.5,
    });
  });

  it('validates and prints a list the way the Fantasy Triumph engine does', () => {
    expect(fantasy.validate(list, fantasyReference)).toEqual(
      fantasyValidationReport(list, fantasyCatalogue(fantasyReference)),
    );
    expect(
      fantasy.sheetData(
        { name: 'Wyrm host', selection: list },
        fantasyReference,
      ),
    ).toEqual(
      fantasySheet({ name: 'Wyrm host', selection: list }, fantasyReference),
    );
  });

  it('names a new list after the game and the day it was started', () => {
    const at = new Date('2026-09-20T10:00:00.000Z');

    expect(fantasy.listTitle(fantasyReference, at)).toBe(
      defaultListName('Fantasy Triumph', at),
    );
  });
});
