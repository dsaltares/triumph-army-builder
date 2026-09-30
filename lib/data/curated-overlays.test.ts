import { beforeAll, describe, expect, it } from 'vitest';
import { curatedOverlayProblems } from '@/lib/data/curated-overlays.ts';
import { battleCardSchema } from '@/lib/data/schema.ts';
import type { MeshweshSnapshot } from '@/lib/data/snapshot.ts';
import { rawBattleCard } from '@/test/fixtures/meshwesh.ts';
import { sampleCuration, sampleSnapshot } from '@/test/sample.ts';

const battleCard = (overrides: Record<string, unknown> = {}) =>
  battleCardSchema.parse(rawBattleCard(overrides));

const problemsFor = (battleCards: ReturnType<typeof battleCard>[]) =>
  curatedOverlayProblems(sampleCuration, {
    armyLists: [],
    allyArmyLists: [],
    battleCards,
  });

describe('curatedOverlayProblems', () => {
  let snapshot: MeshweshSnapshot;

  beforeAll(async () => {
    snapshot = await sampleSnapshot();
  });

  it('finds nothing to re-audit in the sample snapshot', () => {
    expect(curatedOverlayProblems(sampleCuration, snapshot)).toEqual([]);
  });

  it('reports a renamed battle card', () => {
    expect(
      problemsFor([battleCard({ displayName: 'Fortified Base' })]),
    ).toContain(
      'battle card FC is curated as Fortified Camp but upstream now calls it Fortified Base',
    );
  });

  it('reports a battle card that changed category', () => {
    expect(problemsFor([battleCard({ category: 'troop' })])).toContain(
      'battle card FC Fortified Camp is curated as army but upstream now files it under troop',
    );
  });

  it('reports a cost line upstream no longer carries', () => {
    expect(
      problemsFor([battleCard({ mdText: '#### Cost\n2 points\n' })]),
    ).toContain(
      'battle card FC Fortified Camp prices "1 point", which upstream no longer says',
    );
  });

  it('reports a curated battle card that upstream dropped', () => {
    expect(problemsFor([])).toContain(
      'battle card PD Prepared Defenses is curated but no longer exists upstream',
    );
  });

  it('reports sub-faction and battle card drift together', () => {
    const problems = curatedOverlayProblems(sampleCuration, {
      armyLists: [],
      allyArmyLists: [],
      battleCards: [battleCard({ displayName: 'Fortified Base' })],
    });

    expect(problems).toContain(
      '2a Sylvan Courts is curated but no longer exists upstream',
    );
    expect(problems).toContain(
      'battle card FC is curated as Fortified Camp but upstream now calls it Fortified Base',
    );
  });
});
