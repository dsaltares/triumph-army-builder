import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SharedCopyBadge,
  SharedListView,
} from '@/components/share/shared-list-view';
import { buildArmyList } from '@/lib/domain/army/army-list';
import type { TriumphSavedArmy } from '@/lib/domain/army/saved-army';
import {
  emptySelection,
  withArmyBattleCard,
  withGeneral,
  withStands,
} from '@/lib/domain/army/selection';
import type { SharedList } from '@/lib/domain/army/shared-list';
import {
  draftView,
  type ListView,
  savedView,
  sharedView,
} from '@/lib/domain/army/shared-view';
import {
  armyDetail,
  builderArmyDetail,
  fixtureSelection,
} from '@/test/fixtures/army';
import {
  sampleBattleCards,
  sampleTroopTypes,
  withRulebookValues,
} from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const unmeasuredTroopTypes = sampleTroopTypes;

const troopTypes = unmeasuredTroopTypes.map(withRulebookValues);

const battleCards = sampleBattleCards;

const armyList = buildArmyList(armyDetail());

const spearmen = armyList.main.troopOptions[0];
if (!spearmen) {
  throw new Error('the fixture army no longer has a first troop option');
}

const dataVersion = '2026-09-17.abcdef01';

const selection = withArmyBattleCard(
  withGeneral(
    withStands(fixtureSelection({ dataVersion }), spearmen, 'SPR', 6),
    { option: spearmen.id, troopType: 'SPR' },
  ),
  'FC',
  1,
);

const shared = (overrides: Partial<SharedList> = {}): SharedList => ({
  id: 'AbCdEfGhIjKl',
  game: 'triumph',
  name: 'Cannae',
  armyListId: armyList.id,
  dataVersion,
  selection,
  createdAt: '2026-09-20T10:00:00.000Z',
  ...overrides,
});

const saved = (
  overrides: Partial<TriumphSavedArmy> = {},
): TriumphSavedArmy => ({
  id: 'saved-1',
  game: 'triumph',
  name: 'Cannae',
  armyListId: armyList.id,
  dataVersion,
  selection,
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
  ...overrides,
});

const render = (view: ListView) =>
  renderUi(
    <>
      {view.kind === 'shared' && <SharedCopyBadge />}
      <SharedListView view={view} currentDataVersion={dataVersion} />
    </>,
  );

const show = (list: SharedList = shared()) =>
  render(sharedView({ shared: list, armyList, troopTypes, battleCards }));

const showSaved = (list: TriumphSavedArmy = saved()) =>
  render(
    savedView({
      saved: list,
      collection: [],
      armyList,
      troopTypes,
      battleCards,
    }),
  );

const section = (name: string) => {
  const heading = screen.getByRole('heading', { name, level: 2 });
  const found = heading.closest('section');
  if (!found) {
    throw new Error(`no section holds ${name}`);
  }
  return within(found);
};

describe('SharedListView', () => {
  it('shows what the list is worth and whether it is legal', () => {
    show();

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '25 of 48 points, 23 left',
    );
    expect(
      screen.getByRole('button', { name: /^Legal.* show validation$/ }),
    ).toBeVisible();
    expect(section('Validation').getByText('1 warning')).toBeVisible();
  });

  it('names the army, the year and the general', () => {
    show();

    expect(screen.getByText('Fixture Army, 3000–2800 BC')).toBeVisible();
    expect(screen.getByText('2900 BC')).toBeVisible();
    expect(screen.getByText('Spear — Fixture Army')).toBeVisible();
    expect(screen.getByText('Fortified camp')).toBeVisible();
  });

  it('lays the facts out in the order the sheet prints them', () => {
    show();

    const labels = screen.getAllByRole('term').map((term) => term.textContent);
    expect(labels.slice(0, 5)).toEqual([
      'Army',
      'Year',
      'General',
      'Camp',
      'Invasion rating',
    ]);
  });

  it('lays the troops out as a table, one per contingent', () => {
    show();

    const table = within(
      section('Fixture Army').getByRole('table', { name: 'Fixture Army' }),
    );
    expect(
      table.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual([
      'Troop type',
      'Pts/stand',
      'Total',
      'Move',
      'v Foot',
      'v Mtd',
      'Shoot',
      'Shot at',
    ]);
  });

  it('heads each row with the stands taken, with the general marked', () => {
    show();

    const rowHeading = section('Fixture Army').getByRole('rowheader');
    expect(rowHeading).toHaveTextContent('6 × Spear');
    expect(within(rowHeading).getByText('General')).toBeVisible();
  });

  it('gives each troop type its points, movement and combat factors, in column order', () => {
    show();

    const row = section('Fixture Army')
      .getAllByRole('row')
      .find((candidate) => within(candidate).queryByRole('rowheader'));
    if (!row) {
      throw new Error('the contingent has no troop row');
    }
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['4', '24', '3', '4', '4', '0', '3']);
  });

  it('shows a dash for the movement the data does not give', () => {
    render(
      sharedView({
        shared: shared(),
        armyList,
        troopTypes: unmeasuredTroopTypes,
        battleCards,
      }),
    );

    const row = section('Fixture Army')
      .getAllByRole('row')
      .find((candidate) => within(candidate).queryByRole('rowheader'));
    expect(
      within(row ?? document.body)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['4', '24', '—', '4', '4', '0', '3']);
  });

  it('marks a battle-line troop under its name, not in the description', () => {
    show();

    const rowHeading = section('Fixture Army').getByRole('rowheader');
    expect(rowHeading).toHaveTextContent('Battle line');
    expect(section('Fixture Army').getAllByText('Battle line')).toHaveLength(1);
  });

  it('keeps an option with several troop types together, described once', () => {
    const builderList = buildArmyList(builderArmyDetail());
    const dwellers = builderList.main.troopOptions[1];
    if (!dwellers) {
      throw new Error('the builder fixture no longer has a second option');
    }
    renderUi(
      <SharedListView
        view={sharedView({
          shared: shared({
            armyListId: builderList.id,
            selection: withStands(
              withStands(
                emptySelection({
                  army: builderList.id,
                  dataVersion,
                  year: -2900,
                }),
                dwellers,
                'LFT',
                1,
              ),
              dwellers,
              'RBL',
              1,
            ),
          }),
          armyList: builderList,
          troopTypes,
          battleCards,
        })}
        currentDataVersion={dataVersion}
      />,
    );

    const [, group] = section('Fixture Builder Army').getAllByRole('rowgroup');
    if (!group) {
      throw new Error('the contingent has no option rows');
    }
    expect(
      within(group)
        .getAllByRole('rowheader')
        .map((cell) => cell.firstElementChild?.textContent),
    ).toEqual(['1 × Light Foot', '1 × Rabble']);
    expect(within(group).getAllByText('Hill and marsh dwellers')).toHaveLength(
      1,
    );
  });

  it('lists the battle cards taken', () => {
    show();

    expect(section('Battle cards').getByText('Fortified Camp')).toBeVisible();
  });

  it('says when nothing has been taken', () => {
    show(shared({ selection: { ...selection, stands: {} } }));

    expect(screen.getByText('This list has no stands yet.')).toBeVisible();
  });

  it('says when the list was shared, and offers the PDF and a builder of your own', () => {
    show();

    expect(screen.getByText('Shared copy')).toBeVisible();
    expect(screen.getByText(/Shared on 20 September 2026/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open it as a PDF' }),
    ).toHaveAttribute('href', expect.stringContaining('/sheet?s='));
    expect(
      screen.getByRole('link', { name: 'build your own Fixture Army list' }),
    ).toHaveAttribute('href', `/armies/${armyList.id}/build`);
  });

  it('never checks a shared copy against a collection', () => {
    show();

    expect(
      screen.queryByRole('heading', { name: 'Can I build it?' }),
    ).not.toBeInTheDocument();
  });

  it('warns when the copy was built against older list data', () => {
    show(shared({ dataVersion: '2026-01-01.00000000' }));

    expect(
      screen.getByText('Built against an older list version'),
    ).toBeVisible();
  });
});

describe('SharedListView of your own list', () => {
  it('says it follows your edits, with no badge calling it a copy', () => {
    showSaved();

    expect(screen.queryByText('Shared copy')).not.toBeInTheDocument();
    expect(screen.getByText(/Last saved on 21 September 2026/)).toBeVisible();
    expect(
      screen.getByText(/what you change in the builder shows here/),
    ).toBeVisible();
  });

  it("leads to the builder, and offers nothing meant for somebody else's list", () => {
    showSaved();

    expect(
      screen.getByRole('link', { name: 'Edit it in the builder' }),
    ).toHaveAttribute('href', `/triumph/build?list=saved-1`);
    expect(
      screen.queryByRole('link', { name: 'Open it as a PDF' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /build your own/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the same sheet a share of it would', () => {
    showSaved();

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '25 of 48 points, 23 left',
    );
    expect(section('Battle cards').getByText('Fortified Camp')).toBeVisible();
  });
});

describe('SharedListView of a list not saved yet', () => {
  it('says nothing is kept until the list is edited, and links nowhere else', () => {
    render(
      draftView({
        selection,
        collection: [],
        armyList,
        troopTypes,
        battleCards,
      }),
    );

    expect(screen.getByText(/^Not saved yet/)).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Edit it in the builder' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Shared copy')).not.toBeInTheDocument();
  });
});
