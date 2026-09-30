import { describe, expect, it } from 'vitest';
import { buildBundle, bundlePaths } from '@/lib/data/bundle.ts';
import { battleCardTextSchema } from '@/lib/data/bundle-schema.ts';
import { sampleCuration, sampleSnapshot } from '@/test/sample.ts';
import { battleCardReference, type DescribedCard } from './reference.ts';

const card = (
  permanentCode: DescribedCard['permanentCode'],
  displayName: string,
  category: DescribedCard['category'],
  showInList = true,
): DescribedCard => ({
  permanentCode,
  displayName,
  listName: displayName,
  category,
  showInList,
});

describe('battleCardReference', () => {
  const groups = battleCardReference(
    [
      card('HL', 'Hold the Line', 'troop'),
      card('PD', 'Prepared Defenses', 'army'),
      card('AM', 'Ambush', 'army'),
      card('CC', 'Charging Camelry', 'troop', false),
    ],
    {
      AM: 'ambush text',
      PD: 'defenses text',
      HL: 'line text',
      CC: 'camel text',
    } as Record<DescribedCard['permanentCode'], string>,
  );

  it('puts the army-wide cards before the troop cards', () => {
    expect(groups.map(({ category }) => category)).toEqual(['army', 'troop']);
  });

  it('sorts the cards of a group by the name on the card', () => {
    expect(groups[0]?.cards.map(({ displayName }) => displayName)).toEqual([
      'Ambush',
      'Prepared Defenses',
    ]);
  });

  it('attaches the rules text of each card', () => {
    expect(groups[0]?.cards[0]?.text).toBe('ambush text');
  });

  it('keeps the half of a pair that no army list prints', () => {
    expect(groups[1]?.cards.map(({ permanentCode }) => permanentCode)).toEqual([
      'CC',
      'HL',
    ]);
  });
});

describe('the generated bundle', () => {
  it('has rules text for every card in the snapshot', async () => {
    const snapshot = await sampleSnapshot();
    const written = buildBundle(snapshot, sampleCuration).find(
      ({ path }) => path === bundlePaths.battleCardText,
    );
    const text = battleCardTextSchema.parse(written?.contents);

    const groups = battleCardReference(snapshot.battleCards, text);
    const cards = groups.flatMap(({ cards: grouped }) => grouped);

    expect(cards).toHaveLength(27);
    expect(cards.every(({ text: rules }) => rules.length > 0)).toBe(true);
  });
});
