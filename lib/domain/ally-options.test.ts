import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshweshArmyList, MeshweshDateRange } from '@/lib/data/schema.ts';
import type { MeshweshSnapshot } from '@/lib/data/snapshot.ts';
import { sampleSnapshot } from '@/test/sample.ts';
import {
  allyOptionContingents,
  allyOptionKind,
  contingentKind,
} from './ally-options';

const ally = (name: string) => ({ name, internalContingent: false });

const contingent = (name: string) => ({ name, internalContingent: true });

const unbounded = {
  startDate: Number.NEGATIVE_INFINITY,
  endDate: Number.POSITIVE_INFINITY,
};

const span = (dateRange: MeshweshDateRange | null) => dateRange ?? unbounded;

const covers = (
  outer: MeshweshDateRange | null,
  inner: MeshweshDateRange | null,
) =>
  span(outer).startDate <= span(inner).startDate &&
  span(inner).endDate <= span(outer).endDate;

describe('contingentKind', () => {
  it('separates an optional contingent from an allied one', () => {
    expect(contingentKind(contingent('Bukharan levies'))).toBe('optional');
    expect(contingentKind(ally('Ember Principalities'))).toBe('allied');
  });
});

describe('allyOptionKind', () => {
  it('is an optional contingent when no allied contingent is named', () => {
    expect(
      allyOptionKind({ allyEntries: [contingent('Turkoman infantry')] }),
    ).toBe('optionalContingent');
  });

  it('is an ally troop option when an allied contingent is named', () => {
    expect(allyOptionKind({ allyEntries: [ally('Mamluk allies')] })).toBe(
      'allyTroopOption',
    );
  });

  it('spends the army ally slot even when mixed with a contingent', () => {
    const mixed = {
      allyEntries: [ally('Mamluk allies'), contingent('Turkoman infantry')],
    };

    expect(allyOptionKind(mixed)).toBe('allyTroopOption');
    expect(allyOptionContingents(mixed)).toEqual([
      { name: 'Mamluk allies', kind: 'allied' },
      { name: 'Turkoman infantry', kind: 'optional' },
    ]);
  });
});

describe('the sample snapshot', () => {
  let snapshot: MeshweshSnapshot;

  beforeAll(async () => {
    snapshot = await sampleSnapshot();
  });

  const resolved = () => {
    const byId = new Map(snapshot.allyArmyLists.map((list) => [list.id, list]));
    return snapshot.armyLists.flatMap((armyList) =>
      armyList.allyOptions.map(({ allyEntries, dateRange }) => ({
        armyList,
        dateRange,
        allyEntries: allyEntries.map(({ name, allyArmyList }) => {
          const list = byId.get(allyArmyList);
          if (!list) {
            throw new Error(`${allyArmyList} is missing from allyArmyLists`);
          }
          return {
            name,
            allyArmyList,
            internalContingent: list.internalContingent,
          };
        }),
      })),
    );
  };

  const mixed = () =>
    resolved().filter(
      (option) =>
        new Set(allyOptionContingents(option).map(({ kind }) => kind)).size > 1,
    );

  const armyKey = ({ listId, sublistId }: MeshweshArmyList) =>
    `${listId}${sublistId}`;

  it('splits every ally option into 3 contingents and 9 ally options', () => {
    const kinds = resolved().map(allyOptionKind);

    expect(kinds.filter((kind) => kind === 'optionalContingent')).toHaveLength(
      3,
    );
    expect(kinds.filter((kind) => kind === 'allyTroopOption')).toHaveLength(9);
  });

  it('never names two optional contingents in one option', () => {
    const both = resolved().filter(
      (option) =>
        allyOptionContingents(option).filter(({ kind }) => kind === 'optional')
          .length > 1,
    );

    expect(both).toEqual([]);
  });

  it('mixes the two kinds in one option, on the Iron Crown Knights', () => {
    expect(mixed()).toHaveLength(1);
    expect(mixed().map(({ armyList }) => armyKey(armyList))).toEqual(['7a']);
    expect(mixed()[0]?.allyEntries.map(({ name }) => name)).toEqual([
      'Sylvan allies',
      'Crown militia',
    ]);
    expect(mixed().map(allyOptionKind)).toEqual(['allyTroopOption']);
  });

  it('offers every mixed option again as separate single-entry options', () => {
    const unreachable = mixed().filter(
      ({ armyList, dateRange, allyEntries }) =>
        !allyEntries.every((entry) =>
          armyList.allyOptions.some(
            (option) =>
              option.allyEntries.length === 1 &&
              option.allyEntries[0]?.allyArmyList === entry.allyArmyList &&
              covers(option.dateRange, dateRange),
          ),
        ),
    );

    expect(unreachable).toEqual([]);
  });
});
