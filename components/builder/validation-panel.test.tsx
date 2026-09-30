import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { builderAnchors } from '@/components/builder/finding-anchor';
import {
  LegalityBadge,
  ValidationPanel,
} from '@/components/builder/validation-panel';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { battleCardChoices } from '@/lib/domain/army/battle-card-selection';
import {
  allyTroopOptions,
  optionalContingents,
} from '@/lib/domain/army/contingent-selection';
import {
  type ArmySelection,
  emptySelection,
  withGeneral,
  withStands,
} from '@/lib/domain/army/selection';
import { requiredTroops } from '@/lib/domain/army/troop-selection';
import { validationReport } from '@/lib/domain/army/validation-report';
import { troopTypeCosts, troopTypeNames } from '@/lib/domain/troop-types';
import { armyDetail } from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);

const list = buildArmyList(armyDetail());

const spearmen = list.main.troopOptions[0];
const archers = list.main.troopOptions[1];
const knights = list.main.troopOptions[2];
const optionalGroup = list.contingentGroups[0];

if (!spearmen || !archers || !knights || !optionalGroup) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const lightFoot = optionalGroup.contingents[0].troopOptions[0];

if (!lightFoot) {
  throw new Error('the fixture army no longer offers a contingent to leave');
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

const legal = withGeneral(
  withStands(
    withStands(withStands(empty, spearmen, 'SPR', 6), archers, 'ARC', 4),
    knights,
    'KNT',
    2,
  ),
  { option: spearmen.id, troopType: 'SPR' },
);

const anchorsFor = (selection: ArmySelection) =>
  builderAnchors({
    troops: requiredTroops(list, selection, costs),
    contingents: optionalContingents(list, selection, costs),
    allies: allyTroopOptions(list, selection, costs),
    cards: battleCardChoices(list, selection, costs),
  });

const show = (selection: ArmySelection) =>
  renderUi(
    <ValidationPanel
      report={validationReport(list, selection, costs, names)}
      anchors={anchorsFor(selection)}
    />,
  );

const showBadge = (selection: ArmySelection) =>
  renderUi(
    <LegalityBadge
      report={validationReport(list, selection, costs, names)}
      anchors={anchorsFor(selection)}
    />,
  );

const finding = (message: RegExp) =>
  screen.getByRole('link', { name: message });

describe('ValidationPanel', () => {
  it('says a finished army is legal and leaves it at that', () => {
    show(legal);

    expect(screen.getByRole('status')).toHaveTextContent(
      /Legal\s*This list is valid\./,
    );
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('counts what it found against a list still being built', () => {
    show(empty);

    expect(screen.getByRole('status')).toHaveTextContent(
      /Illegal\s*2 errors · 1 warning/,
    );
  });

  it('links a finding to the choice that caused it', () => {
    show(empty);

    expect(finding(/Spear needs at least 2 stands/)).toHaveAttribute(
      'href',
      '#troops-main-0',
    );
  });

  it('links the unspent points to the meter and the general to its section', () => {
    show(empty);

    expect(finding(/points selected/)).toHaveAttribute('href', '#points');
    expect(finding(/must be the general/)).toHaveAttribute('href', '#general');
  });

  it('leaves a finding with nothing on the page to point at unlinked', () => {
    show(withStands(empty, lightFoot, 'LFT', 1));

    const stranded = screen.getByText(
      /is in a contingent the army has not taken, and is not counted/,
    );

    expect(stranded).toBeInTheDocument();
    expect(stranded.closest('a')).toBeNull();
  });

  it('reads every finding out with its severity', () => {
    show(empty);

    expect(screen.getAllByText('Breaks a rule:')).toHaveLength(2);
    expect(screen.getByText('Worth a look:')).toBeInTheDocument();
  });
});

describe('LegalityBadge', () => {
  it('reads the verdict', () => {
    showBadge(legal);

    expect(
      screen.getByRole('button', { name: 'Legal — show validation' }),
    ).toBeInTheDocument();
  });

  it('carries the count of what is wrong', () => {
    showBadge(empty);

    expect(
      screen.getByRole('button', {
        name: 'Illegal, 2 errors · 1 warning — show validation',
      }),
    ).toBeInTheDocument();
  });

  it('opens the findings on a click, and points at the panel', async () => {
    const { user } = showBadge(empty);

    await user.click(screen.getByRole('button', { name: /show validation$/ }));

    const popup = within(await screen.findByRole('dialog'));
    expect(popup.getByText('2 errors · 1 warning')).toBeInTheDocument();
    expect(popup.getAllByText('Breaks a rule:')).toHaveLength(2);
    expect(popup.getByRole('link', { name: 'Validation' })).toHaveAttribute(
      'href',
      '#validation',
    );
  });

  it('closes once the player follows a finding to its place', async () => {
    const { user } = showBadge(empty);
    await user.click(screen.getByRole('button', { name: /show validation$/ }));
    const popup = within(await screen.findByRole('dialog'));

    await user.click(
      popup.getAllByRole('link', { name: /needs at least/ })[0] as HTMLElement,
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('opens the findings on hover too', async () => {
    const { user } = showBadge(empty);

    await user.hover(screen.getByRole('button', { name: /show validation$/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
