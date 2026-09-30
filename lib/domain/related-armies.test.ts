import { describe, expect, it } from 'vitest';
import {
  listNumber,
  type RelatedArmy,
  relatedArmies,
} from './related-armies.ts';

const army = (
  id: string,
  key: string,
  name: string,
  startDate = -3000,
  endDate = -2800,
): RelatedArmy => ({ id, key, name, startDate, endDate });

const index = [
  army('1', '24a', 'Sunspire Dominion'),
  army('2', '24b', 'Neo-Hittite'),
  army('3', '24.5a', 'Hittite Vassals'),
  army('4', '7b', 'Hollow Necropolis'),
  army('5', '9a', 'Early Kassites'),
];

const names = (armies: readonly RelatedArmy[]) =>
  armies.map(({ name }) => name);

describe('listNumber', () => {
  it('drops the sub-list letter', () => {
    expect(listNumber('24a')).toBe('24');
  });

  it('keeps the fractional number upstream uses to insert a list', () => {
    expect(listNumber('186.5a')).toBe('186.5');
  });
});

describe('relatedArmies', () => {
  it('names the enemies an army is paired against', () => {
    const { enemies } = relatedArmies(
      index,
      {
        id: '1',
        key: '24a',
        enemies: ['5', '4'],
      },
      'en',
    );

    expect(names(enemies)).toEqual(['Early Kassites', 'Hollow Necropolis']);
  });

  it('leaves the army itself out of its own enemies', () => {
    const { enemies } = relatedArmies(
      index,
      {
        id: '1',
        key: '24a',
        enemies: ['1', '4'],
      },
      'en',
    );

    expect(names(enemies)).toEqual(['Hollow Necropolis']);
  });

  it('reports the army that is paired against itself', () => {
    expect(
      relatedArmies(index, { id: '1', key: '24a', enemies: ['1', '4'] }, 'en')
        .facesItself,
    ).toBe(true);
    expect(
      relatedArmies(index, { id: '1', key: '24a', enemies: ['4'] }, 'en')
        .facesItself,
    ).toBe(false);
  });

  it('counts a repeated enemy once', () => {
    const { enemies } = relatedArmies(
      index,
      {
        id: '1',
        key: '24a',
        enemies: ['4', '4'],
      },
      'en',
    );

    expect(names(enemies)).toEqual(['Hollow Necropolis']);
  });

  it('drops an enemy the index does not hold', () => {
    const { enemies } = relatedArmies(
      index,
      {
        id: '1',
        key: '24a',
        enemies: ['4', 'gone'],
      },
      'en',
    );

    expect(names(enemies)).toEqual(['Hollow Necropolis']);
  });

  it('gathers the other sub-lists of the same numbered list', () => {
    const { sublists } = relatedArmies(
      index,
      {
        id: '1',
        key: '24a',
        enemies: [],
      },
      'en',
    );

    expect(names(sublists)).toEqual(['Neo-Hittite']);
  });

  it('keeps the index order of the sub-lists', () => {
    const { sublists } = relatedArmies(
      index,
      {
        id: '2',
        key: '24b',
        enemies: [],
      },
      'en',
    );

    expect(names(sublists)).toEqual(['Sunspire Dominion']);
  });

  it('does not take a fractional list number for a sub-list of its neighbour', () => {
    const { sublists } = relatedArmies(
      index,
      {
        id: '3',
        key: '24.5a',
        enemies: [],
      },
      'en',
    );

    expect(sublists).toEqual([]);
  });

  it('leaves an army that is alone in its number with no sub-lists', () => {
    const { sublists } = relatedArmies(
      index,
      {
        id: '4',
        key: '7b',
        enemies: [],
      },
      'en',
    );

    expect(sublists).toEqual([]);
  });
});
