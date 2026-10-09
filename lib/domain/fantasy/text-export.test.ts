import { beforeAll, describe, expect, it } from 'vitest';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import type { FantasyReference } from './reference.ts';
import { fantasySheet } from './sheet-data.ts';
import { type FantasyTextWords, fantasyTextGroups } from './text-export.ts';

let reference: FantasyReference;

beforeAll(async () => {
  reference = await sampleFantasyReference();
});

const words: FantasyTextWords = {
  label: (label) => `<${label}>`,
  points: (points) => `${points} pts`,
  stands: (stands) => `${stands}×`,
  topography: (topography) => topography.toLowerCase(),
};

const groups = (selection: ReturnType<typeof fantasySelection>) =>
  fantasyTextGroups(
    fantasySheet({ name: 'Dwarves', selection }, reference),
    words,
  );

describe('fantasyTextGroups', () => {
  it('writes the title, totals, format, units, heroes and army cards in sheet order', () => {
    expect(
      groups(
        fantasySelection({
          format: {
            pointsTotal: 51,
            topography: 'Dense Forest',
            invasion: 2,
            maneuver: 3,
          },
          units: [
            fantasyUnit('guard', 'EFT', {
              name: 'Hearth guard',
              stands: 6,
              cards: cards('deadly'),
              marks: { delayedEntry: 1, transports: 2 },
            }),
          ],
          heroes: [
            fantasyHero('thane', {
              name: 'Thane',
              cards: cards('prowess'),
              delayedEntry: true,
            }),
          ],
          armyCards: [
            { code: 'mobileInfantry', variants: { transport: 'ground' } },
            { code: 'fortifiedCamp' },
          ],
          general: 'guard',
        }),
      ),
    ).toEqual([
      [
        { kind: 'title', text: 'Dwarves' },
        {
          kind: 'line',
          strong: true,
          text: '<total>: 36 pts / 51 pts · <victoryValue>: 38 pts · 6×',
        },
      ],
      [
        {
          kind: 'list',
          items: [
            { text: '<pointsTotal>: 51 pts', children: [] },
            { text: '<topography>: dense forest · <dense>', children: [] },
            { text: '<invasionRating>: 2 · 0 pts', children: [] },
            { text: '<manoeuvreRating>: 3 · 1 pts', children: [] },
          ],
        },
      ],
      [
        { kind: 'heading', text: '<units>' },
        {
          kind: 'list',
          items: [
            {
              text: 'Hearth guard — 6× Elite Foot · <general> · 36 pts',
              children: [
                'Deadly',
                '6 pts <perStand>',
                '<delayedEntry>: 1×',
                '<transports>: 2×',
              ],
            },
          ],
        },
      ],
      [
        { kind: 'heading', text: '<heroes>' },
        {
          kind: 'list',
          items: [
            { text: 'Thane — 2 pts', children: ['Prowess', '<delayedEntry>'] },
          ],
        },
      ],
      [
        { kind: 'heading', text: '<armyCards>' },
        {
          kind: 'list',
          items: [
            {
              text: 'Mobile Infantry (Ground transport) ×2 — 1 pts',
              children: [],
            },
            { text: 'Fortified Camp — <unpriced>', children: [] },
            { text: 'Delayed Entry — Hearth guard — -2 pts', children: [] },
            { text: 'Delayed Entry — Thane — -2 pts', children: [] },
          ],
        },
      ],
    ]);
  });

  it('says so when a list has no units, heroes or army cards', () => {
    const [, , units, heroes, armyCards] = groups(fantasySelection());

    expect(units).toEqual([
      { kind: 'heading', text: '<units>' },
      { kind: 'line', text: '<noUnits>' },
    ]);
    expect(heroes?.[1]).toEqual({ kind: 'line', text: '<noHeroes>' });
    expect(armyCards?.[1]).toEqual({ kind: 'line', text: '<noArmyCards>' });
  });
});
