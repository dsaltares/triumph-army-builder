import { describe, expect, it } from 'vitest';
import { unpricedVariantProblems } from './battle-cards.ts';

const flat = (points: number) => ({ kind: 'flat', points }) as const;

describe('unpricedVariantProblems', () => {
  it('finds nothing wrong with a card that prices exactly the variants it offers', () => {
    expect(
      unpricedVariantProblems({
        variants: { flight: { hover: 'Hover', zoom: 'Zoom' } },
        cost: {
          kind: 'byVariant',
          choice: 'flight',
          options: { zoom: flat(2), hover: flat(1) },
        },
      }),
    ).toEqual([]);
  });

  it('finds nothing wrong with a card that offers a variant its cost ignores', () => {
    expect(
      unpricedVariantProblems({
        variants: { effect: { physical: 'Physical', magical: 'Magical' } },
        cost: flat(1),
      }),
    ).toEqual([]);
  });

  it('reports a cost that prices a variant the card does not offer', () => {
    expect(
      unpricedVariantProblems({
        cost: {
          kind: 'byVariant',
          choice: 'reach',
          options: { limited: flat(3), unlimited: flat(4.5) },
        },
      }),
    ).toEqual(['prices by the variant reach, which the card does not offer']);
  });

  it('reports a cost that prices other options than the card offers', () => {
    expect(
      unpricedVariantProblems({
        variants: { reach: { self: 'Self', zone: 'Zone', mindless: 'None' } },
        cost: {
          kind: 'byVariant',
          choice: 'reach',
          options: { self: flat(1), zone: flat(2) },
        },
      }),
    ).toEqual(['prices reach as self, zone but offers mindless, self, zone']);
  });

  it('looks inside a count, a bearer and a variant for the variants they price', () => {
    expect(
      unpricedVariantProblems({
        variants: { transport: { ground: 'Ground', flying: 'Flying' } },
        cost: {
          kind: 'byBearer',
          stand: {
            kind: 'perCount',
            max: 8,
            each: {
              kind: 'byVariant',
              choice: 'transport',
              options: {
                ground: flat(0.5),
                flying: {
                  kind: 'byVariant',
                  choice: 'altitude',
                  options: { low: flat(1), high: flat(2) },
                },
              },
            },
          },
          hero: { kind: 'byTopography', points: 1, dense: 2 },
        },
      }),
    ).toEqual([
      'prices by the variant altitude, which the card does not offer',
    ]);
  });

  it('finds no variant in the costs that cannot hold one', () => {
    expect(
      unpricedVariantProblems({
        cost: {
          kind: 'byTroopType',
          points: -2,
          overrides: [{ when: { troopTypes: ['ART'] }, points: 0 }],
        },
      }),
    ).toEqual([]);
    expect(
      unpricedVariantProblems({
        cost: { kind: 'perMarkedCappedAtValue', points: -2 },
      }),
    ).toEqual([]);
  });
});
