import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { routes } from '@/lib/navigation';
import { renderUi } from '@/test/ui';
import { ReferenceUnavailable } from './reference-unavailable';

describe('ReferenceUnavailable', () => {
  it('says there is nothing to show and offers a way back to saved lists', () => {
    renderUi(<ReferenceUnavailable />);

    expect(
      screen.getByRole('heading', {
        name: 'Army lists are not available right now',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing you have saved is affected/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Armies' })).toHaveAttribute(
      'href',
      routes.myArmies,
    );
  });

  it('speaks the player’s language', () => {
    renderUi(<ReferenceUnavailable />, { locale: 'es' });

    expect(
      screen.getByRole('heading', {
        name: 'Las listas de ejército no están disponibles ahora mismo',
      }),
    ).toBeInTheDocument();
  });
});
