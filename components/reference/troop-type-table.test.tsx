import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TroopTypeTable } from '@/components/reference/troop-type-table';
import type { BundledTroopType } from '@/lib/data/bundle';
import { sampleBundledTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const troopTypes: readonly BundledTroopType[] = sampleBundledTroopTypes;

const show = (shown: readonly BundledTroopType[] = troopTypes) =>
  renderUi(<TroopTypeTable troopTypes={shown} />);

const knights = troopTypes.filter(
  ({ permanentCode }) => permanentCode === 'KNT',
);

const onlyRow = () =>
  within(
    within(screen.getByRole('list', { name: 'Open order' })).getByRole(
      'listitem',
    ),
  );

describe('TroopTypeTable', () => {
  it('splits the troop types into the two categories', () => {
    show();

    expect(screen.getByRole('heading', { name: 'Foot' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Mounted' }),
    ).toBeInTheDocument();
  });

  it('groups close order before open order under each category', () => {
    show();

    expect(
      screen.getAllByRole('heading').map(({ textContent }) => textContent),
    ).toEqual([
      'Foot',
      'Close order',
      'Open order',
      'Mounted',
      'Close order',
      'Open order',
    ]);
  });

  it('says the order on every row, not only in the group heading', () => {
    show();

    for (const list of screen.getAllByRole('list', { name: 'Close order' })) {
      for (const row of within(list).getAllByRole('listitem')) {
        expect(within(row).getByText('Close')).toBeInTheDocument();
      }
    }
    for (const list of screen.getAllByRole('list', { name: 'Open order' })) {
      for (const row of within(list).getAllByRole('listitem')) {
        expect(within(row).getByText('Open')).toBeInTheDocument();
      }
    }
  });

  it('labels every field of a row, for a reader who cannot see the columns', () => {
    show(knights);

    for (const label of [
      'Troop type',
      'Cost',
      'Order',
      'Close combat',
      'Ranged combat',
      'Description',
    ]) {
      expect(
        onlyRow().getByText(label, {
          selector: 'dt',
        }),
      ).toBeInTheDocument();
    }
  });

  it('names every troop type in the snapshot', () => {
    show();

    for (const { displayName } of troopTypes) {
      expect(screen.getByText(displayName)).toBeInTheDocument();
    }
  });

  it('shows the cost, the order and all four combat factors of a stand', () => {
    show(knights);

    const row = onlyRow();
    expect(row.getByText('Kn · KNT')).toBeInTheDocument();
    expect(row.getByText('Open')).toBeInTheDocument();
    expect(row.getByText(/vs foot/)).toBeInTheDocument();
    expect(row.getByText(/vs mounted/)).toBeInTheDocument();
    expect(row.getByText(/shooting/)).toBeInTheDocument();
    expect(row.getByText(/shot at/)).toBeInTheDocument();
  });

  it('carries the description of every troop type', () => {
    show();

    for (const { description } of troopTypes) {
      expect(
        screen.getByText(description.replace(/\s+/g, ' ').trim()),
      ).toBeInTheDocument();
    }
  });
});
