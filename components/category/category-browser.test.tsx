import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryBrowser } from '@/components/category/category-browser';
import { renderUi } from '@/test/ui';

const categories = [
  { id: 'k1', name: 'Cradle of Civilization', armyCount: 21 },
  { id: 'k2', name: 'Corsair Seas', armyCount: 27 },
  { id: 'k3', name: 'Rise of Rome', armyCount: 18 },
  { id: 'k4', name: 'Medieval Western Europe', armyCount: 31 },
];

const show = () => renderUi(<CategoryBrowser categories={categories} />);

const search = () => screen.getByLabelText('Search categories');

const listed = () =>
  screen.queryAllByRole('link').map((link) => link.textContent);

describe('CategoryBrowser', () => {
  it('offers a search field', () => {
    show();

    expect(search()).toHaveAttribute('type', 'search');
  });

  it('holds every category before anything is typed', () => {
    show();

    expect(screen.getByText('4 categories')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Cradle of Civilization/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Corsair Seas/ }),
    ).toBeInTheDocument();
  });

  it('narrows the categories to the ones that match', async () => {
    const { user } = show();

    await user.type(search(), 'rome');

    expect(await screen.findByText('2 of 4 categories')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Rise of Rome/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Corsair Seas/ }),
    ).not.toBeInTheDocument();
  });

  it('forgives a typo', async () => {
    const { user } = show();

    await user.type(search(), 'medival');

    await screen.findByText('1 of 4 categories');

    expect(listed()).toEqual(['Medieval Western Europe31 army lists']);
  });

  it('says so when nothing matches', async () => {
    const { user } = show();

    await user.type(search(), 'helicopter');

    expect(await screen.findByText('No category matches')).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing is filed under “helicopter”/),
    ).toBeInTheDocument();
    expect(screen.getByText('0 of 4 categories')).toBeInTheDocument();
  });

  it('brings the whole list back when the search is cleared', async () => {
    const { user } = show();

    await user.type(search(), 'helicopter');
    await screen.findByText('0 of 4 categories');
    await user.clear(search());

    expect(await screen.findByText('4 categories')).toBeInTheDocument();
    expect(listed()).toHaveLength(4);
  });
});
