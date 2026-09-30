import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryList } from '@/components/category/category-list';
import { renderUi } from '@/test/ui';

const categories = [
  {
    id: 'k1',
    name: 'Cradle of Civilization',
    armyCount: 21,
    span: { startDate: -3000, endDate: 1500 },
  },
  {
    id: 'k2',
    name: 'Tidewrack Invasions',
    armyCount: 1,
    span: { startDate: -1208, endDate: -1176 },
  },
  { id: 'k3', name: 'Empty Category', armyCount: 0 },
];

const show = () => renderUi(<CategoryList categories={categories} />);

describe('CategoryList', () => {
  it('names every category', () => {
    show();

    expect(
      screen.getByRole('link', { name: /Cradle of Civilization/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Tidewrack Invasions/ }),
    ).toBeInTheDocument();
  });

  it('says how many army lists each one holds', () => {
    show();

    expect(screen.getByText('21 army lists')).toBeInTheDocument();
    expect(screen.getByText('1 army list')).toBeInTheDocument();
  });

  it('says which years each one covers', () => {
    show();

    expect(
      screen.getByRole('link', { name: /Cradle of Civilization/ }),
    ).toHaveTextContent('3000 BC – 1500 AD');
    expect(
      screen.getByRole('link', { name: /Tidewrack Invasions/ }),
    ).toHaveTextContent('1208–1176 BC');
  });

  it('gives no years to a category without armies', () => {
    show();

    expect(
      screen.getByRole('link', { name: /Empty Category/ }),
    ).not.toHaveTextContent(/BC|AD/);
  });

  it('leads to the category', () => {
    show();

    expect(
      screen.getByRole('link', { name: /Cradle of Civilization/ }),
    ).toHaveAttribute('href', '/categories/k1');
    expect(
      screen.getByRole('link', { name: /Tidewrack Invasions/ }),
    ).toHaveAttribute('href', '/categories/k2');
  });
});
