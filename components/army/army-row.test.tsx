import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArmyRow, type RowCategory } from '@/components/army/army-row';
import { armyIndexEntry } from '@/test/fixtures/army';
import { renderUi } from '@/test/ui';

const show = (
  army = armyIndexEntry(),
  categories: readonly RowCategory[] = [
    { id: 'cradle', name: 'Cradle of Civilization' },
  ],
) => renderUi(<ArmyRow army={army} categories={categories} />);

describe('ArmyRow', () => {
  it('names the army, its span and its ratings', () => {
    show();

    expect(screen.getByText('Fixture Army')).toBeInTheDocument();
    expect(screen.getByText('3000–2800 BC')).toBeInTheDocument();
    expect(screen.getByText(/Invasion 2 · Manoeuvre 1/)).toBeInTheDocument();
  });

  it('opens the army from its name', () => {
    show(armyIndexEntry({ id: 'fixture-army' }));

    expect(screen.getByRole('link', { name: 'Fixture Army' })).toHaveAttribute(
      'href',
      '/armies/fixture-army',
    );
  });

  it('puts every home topography on the ratings line', () => {
    show(armyIndexEntry({ topographies: ['Arable', 'Hilly'] }));

    expect(
      screen.getByText(/Invasion 2 · Manoeuvre 1 · Arable · Hilly$/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Arable' }),
    ).not.toBeInTheDocument();
  });

  it('links every thematic category to its page', () => {
    show(armyIndexEntry(), [
      { id: 'cradle', name: 'Cradle of Civilization' },
      { id: 'chariots', name: 'Chariot Supremacy' },
    ]);

    const categories = within(
      screen.getByRole('list', { name: 'Thematic categories' }),
    );
    expect(
      categories.getByRole('link', { name: 'Cradle of Civilization' }),
    ).toHaveAttribute('href', '/categories/cradle');
    expect(
      categories.getByRole('link', { name: 'Chariot Supremacy' }),
    ).toHaveAttribute('href', '/categories/chariots');
  });

  it('leaves the category list out of an army filed nowhere else', () => {
    show(armyIndexEntry(), []);

    expect(
      screen.queryByRole('list', { name: 'Thematic categories' }),
    ).not.toBeInTheDocument();
  });

  it('shows every value of an army rated more than once', () => {
    show(armyIndexEntry({ invasion: [3, 4] }));

    expect(screen.getByText(/Invasion 3 \/ 4/)).toBeInTheDocument();
  });

  it('marks a draft list', () => {
    show(armyIndexEntry({ status: 'DRAFT' }));

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('leaves a published list unmarked', () => {
    show(armyIndexEntry({ status: 'Ready' }));

    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  });
});
