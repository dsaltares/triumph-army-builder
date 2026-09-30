import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BattleCardReference } from '@/components/reference/battle-card-reference';
import type { BattleCardText } from '@/lib/data/bundle';
import type { DescribedCard } from '@/lib/domain/battle-cards/reference';
import { sampleSnapshotBattleCards } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const snapshot = sampleSnapshotBattleCards;

const cards: readonly DescribedCard[] = snapshot.map(
  ({ permanentCode, displayName, listName, category, showInList }) => ({
    permanentCode,
    displayName,
    listName,
    category,
    showInList,
  }),
);

const text = Object.fromEntries(
  snapshot.map(({ permanentCode, mdText }) => [permanentCode, mdText]),
) as BattleCardText;

const show = () => renderUi(<BattleCardReference cards={cards} text={text} />);

const card = (name: string) => {
  const found = screen
    .getByRole('heading', { name, level: 3 })
    .closest('details');
  if (!found) {
    throw new Error(`the ${name} card is not inside a disclosure`);
  }
  return found;
};

describe('BattleCardReference', () => {
  it('splits the cards into the scope each one is bought at', () => {
    show();

    expect(
      screen.getByRole('heading', { name: 'Army battle cards', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Troop battle cards', level: 2 }),
    ).toBeInTheDocument();
  });

  it('names every card in the snapshot, under an anchor of its code', () => {
    show();

    for (const { displayName, permanentCode } of cards) {
      expect(card(displayName)).toHaveAttribute('id', permanentCode);
    }
  });

  it('leaves every card closed so the list stays scannable', () => {
    show();

    for (const { displayName } of cards) {
      expect(card(displayName)).not.toHaveAttribute('open');
    }
  });

  it('opens a card to its full rules text', async () => {
    const { user } = show();
    const fortifiedCamp = card('Fortified Camp');

    await user.click(within(fortifiedCamp).getByText('Fortified Camp'));

    expect(fortifiedCamp).toHaveAttribute('open');
    expect(
      within(fortifiedCamp).getByRole('heading', {
        name: 'In play',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(
      within(fortifiedCamp).getByText('The camp may hold a garrison.'),
    ).toBeInTheDocument();
  });

  it('renders the rules text as headings, paragraphs and bullets', () => {
    show();
    const fortifiedCamp = within(card('Fortified Camp'));

    expect(
      fortifiedCamp.getByRole('heading', {
        name: 'Cost',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(
      fortifiedCamp.getByRole('heading', {
        name: 'Choosing this card',
        level: 4,
      }),
    ).toBeInTheDocument();
    expect(
      fortifiedCamp.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['The camp may hold a garrison.', 'The camp may be plundered.']);
  });

  it('says so for the half of a pair no army list prints', () => {
    show();

    expect(
      within(card('Supportable')).getByText(/It is the other half of a pair/),
    ).toBeInTheDocument();
  });

  it('gives the name an army list prints a card under when it differs', () => {
    show();

    expect(
      screen.getByText(
        'Army lists print this card as Charging Camelry or Armored Camelry.',
      ),
    ).toBeInTheDocument();
  });
});
