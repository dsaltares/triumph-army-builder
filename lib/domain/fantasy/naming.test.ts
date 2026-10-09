import { beforeAll, describe, expect, it } from 'vitest';
import { fantasyUnit } from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import type { TroopTypeNames } from '../troop-types.ts';
import { fantasyTroopTypeNames, unitName, variantNames } from './naming.ts';
import type { FantasyReference } from './reference.ts';

let reference: FantasyReference;
let names: TroopTypeNames;

beforeAll(async () => {
  reference = await sampleFantasyReference();
  names = fantasyTroopTypeNames(reference);
});

describe('fantasyTroopTypeNames', () => {
  it('names troop types under the Fantasy Triumph overlay and keeps the rest', () => {
    expect(names.ARC).toBe('Shooters');
    expect(names.ELE).toBe('Behemoths');
    expect(names.SPR).toBe('Spear');
  });
});

describe('unitName', () => {
  it('uses the name the player typed', () => {
    expect(unitName(fantasyUnit('a', 'ELE', { name: ' Trolls ' }), names)).toBe(
      'Trolls',
    );
  });

  it('falls back to the troop type when the player typed nothing', () => {
    expect(unitName(fantasyUnit('a', 'ELE', { name: '  ' }), names)).toBe(
      'Behemoths',
    );
  });
});

describe('variantNames', () => {
  it('names each chosen variant in the order the card offers them, and skips an unknown one', () => {
    const spellblast = reference.cards.find(
      ({ code }) => code === 'spellblast',
    );

    expect(
      variantNames(spellblast, { effect: 'magical', reach: 'limited' }),
    ).toEqual(['Limited Spellblast', 'Magical']);
    expect(variantNames(spellblast, { reach: 'everywhere' })).toEqual([]);
    expect(variantNames(undefined, { reach: 'limited' })).toEqual([]);
  });
});
