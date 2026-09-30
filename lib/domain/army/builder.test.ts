import { describe, expect, it } from 'vitest';
import type { SubFactionGroup } from '@/lib/data/sub-factions.ts';
import { armyDetail } from '@/test/fixtures/army.ts';
import { buildArmyList } from './army-list';
import {
  clampYear,
  declaredVariant,
  gatingEffect,
  pointsMeter,
  startBuilding,
  startingYear,
  subFactionChoice,
  withGating,
} from './builder';
import type { ArmyPoints } from './points';

const subFactions: SubFactionGroup = {
  army: 'Fixture Army',
  label: 'Sub-faction',
  variants: [
    { id: 'kish', name: 'Kish' },
    { id: 'other', name: 'Other city-states' },
  ],
  rules: { 'only Kish': { only: ['kish'] } },
};

const plain = buildArmyList(armyDetail());
const noted = buildArmyList(armyDetail({ subFactions }));
const allied = buildArmyList(
  armyDetail({
    allyOptions: [
      ...armyDetail().allyOptions,
      {
        allyEntries: [
          {
            allyArmyList: 'contingent-ally',
            name: 'Fixture Allied Contingent',
          },
        ],
        dateRange: { startDate: -2950, endDate: -2800 },
        note: null,
      },
    ],
  }),
);

const dataVersion = '2026-09-17.abcdef01';

const points = (overrides: Partial<ArmyPoints> = {}): ArmyPoints => ({
  standPoints: 0,
  allyStandPoints: 0,
  battleCardPoints: 0,
  total: 0,
  standLines: [],
  battleCardLines: [],
  ...overrides,
});

describe('clampYear', () => {
  it('keeps a year the army was around for', () => {
    expect(clampYear(plain.dateRange, -2900)).toBe(-2900);
  });

  it('pulls a year outside the span back to the nearer end', () => {
    expect(clampYear(plain.dateRange, -4000)).toBe(-3000);
    expect(clampYear(plain.dateRange, 1500)).toBe(-2800);
  });

  it('answers with a whole year', () => {
    expect(clampYear(plain.dateRange, -2900.7)).toBe(-2900);
  });
});

describe('startingYear', () => {
  it('opens the builder in the first year the army fielded', () => {
    expect(startingYear(plain)).toBe(-3000);
  });
});

describe('declaredVariant', () => {
  it('is nothing when the army asks no sub-faction question', () => {
    expect(declaredVariant(null, 'kish')).toBeNull();
  });

  it('is nothing when the variant is not one the army declares', () => {
    expect(declaredVariant(subFactions, 'umma')).toBeNull();
    expect(declaredVariant(subFactions, null)).toBeNull();
  });

  it('is the variant when the army declares it', () => {
    expect(declaredVariant(subFactions, 'kish')).toBe('kish');
  });
});

describe('subFactionChoice', () => {
  it('is nothing for an army that asks no question', () => {
    expect(subFactionChoice(plain, null)).toBeNull();
  });

  it('carries the question, its answers and whether one was given', () => {
    expect(subFactionChoice(noted, null)).toEqual({
      label: 'Sub-faction',
      variants: subFactions.variants,
      chosen: null,
      answered: false,
    });
    expect(subFactionChoice(noted, 'kish')).toMatchObject({
      chosen: 'kish',
      answered: true,
    });
  });

  it('treats a variant the army does not declare as unanswered', () => {
    expect(subFactionChoice(noted, 'umma')).toMatchObject({
      chosen: null,
      answered: false,
    });
  });
});

describe('startBuilding', () => {
  it('starts empty, in the army first year, with no sub-faction chosen', () => {
    expect(startBuilding(plain, dataVersion)).toEqual({
      army: plain.id,
      dataVersion,
      year: -3000,
      variant: null,
      contingentGroups: [],
      stands: {},
      general: null,
      armyBattleCards: {},
      troopBattleCards: {},
    });
  });

  it('starts from gating it is handed', () => {
    expect(
      startBuilding(noted, dataVersion, { year: -2850, variant: 'kish' }),
    ).toMatchObject({ year: -2850, variant: 'kish' });
  });
});

describe('withGating', () => {
  it('moves a selection to another year and sub-faction, keeping the rest', () => {
    const selection = startBuilding(noted, dataVersion);

    expect(withGating(selection, { year: -2850, variant: 'kish' })).toEqual({
      ...selection,
      year: -2850,
      variant: 'kish',
    });
  });
});

describe('gatingEffect', () => {
  it('counts every option as available when nothing gates them', () => {
    expect(gatingEffect(plain, { year: -2950, variant: null })).toEqual({
      yearInRange: true,
      troopOptions: { available: 3, total: 3, withheld: 0 },
      contingentGroups: { available: 1, total: 1, withheld: 0 },
    });
  });

  it('withholds a dated option outside its years', () => {
    expect(gatingEffect(plain, { year: -2850, variant: null })).toMatchObject({
      troopOptions: { available: 2, total: 3, withheld: 1 },
    });
  });

  it('withholds a contingent group outside its years', () => {
    expect(gatingEffect(allied, { year: -3000, variant: null })).toMatchObject({
      contingentGroups: { available: 1, total: 2, withheld: 1 },
    });
    expect(gatingEffect(allied, { year: -2900, variant: null })).toMatchObject({
      contingentGroups: { available: 2, total: 2, withheld: 0 },
    });
  });

  it('withholds a noted option until the sub-faction question is answered', () => {
    expect(gatingEffect(noted, { year: -2950, variant: null })).toMatchObject({
      troopOptions: { available: 2, total: 3, withheld: 1 },
    });
    expect(gatingEffect(noted, { year: -2950, variant: 'kish' })).toMatchObject(
      {
        troopOptions: { available: 3, total: 3, withheld: 0 },
      },
    );
    expect(
      gatingEffect(noted, { year: -2950, variant: 'other' }),
    ).toMatchObject({ troopOptions: { available: 2, total: 3, withheld: 1 } });
  });

  it('says when the year is one the army was not around for', () => {
    expect(gatingEffect(plain, { year: 1415, variant: null })).toMatchObject({
      yearInRange: false,
      troopOptions: { available: 2, total: 3, withheld: 1 },
    });
  });
});

describe('pointsMeter', () => {
  it('reads an empty army as the whole cap left to spend', () => {
    expect(pointsMeter(points())).toEqual({
      total: 0,
      cap: 48,
      remaining: 48,
      status: 'under',
      standPoints: 0,
      allyStandPoints: 0,
      battleCardPoints: 0,
      filled: 0,
    });
  });

  it('splits the total the way the points engine does', () => {
    expect(
      pointsMeter(points({ standPoints: 44, battleCardPoints: 2, total: 46 })),
    ).toMatchObject({
      total: 46,
      remaining: 2,
      status: 'under',
      standPoints: 44,
      battleCardPoints: 2,
    });
  });

  it('calls a full army full', () => {
    expect(pointsMeter(points({ standPoints: 48, total: 48 }))).toMatchObject({
      status: 'exact',
      remaining: 0,
      filled: 1,
    });
  });

  it('counts the overspend and stops the bar at the cap', () => {
    expect(pointsMeter(points({ standPoints: 52, total: 52 }))).toMatchObject({
      status: 'over',
      remaining: -4,
      filled: 1,
    });
  });

  it('never fills the bar below empty', () => {
    expect(
      pointsMeter(points({ battleCardPoints: -2, total: -2 })),
    ).toMatchObject({ filled: 0 });
  });

  it('measures against the cap the rules carry', () => {
    expect(
      pointsMeter(points({ standPoints: 48, total: 48 }), { pointsCap: 96 }),
    ).toMatchObject({ cap: 96, remaining: 48, status: 'under', filled: 0.5 });
  });
});
