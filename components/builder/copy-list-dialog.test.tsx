import { screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyListDialog } from '@/components/builder/copy-list-dialog';
import { Toaster } from '@/components/ui/sonner';
import { buildArmyList } from '@/lib/domain/army/army-list';
import {
  emptySelection,
  withGeneral,
  withStands,
} from '@/lib/domain/army/selection';
import { armySheet } from '@/lib/domain/army/sheet';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeMovements,
  troopTypeNames,
} from '@/lib/domain/troop-types';
import { builderArmyDetail, fixtureDataVersion } from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const troopTypes = sampleTroopTypes;

const armyList = buildArmyList(builderArmyDetail());
const option = armyList.main.troopOptions[0];

if (!option) {
  throw new Error('the fixture army no longer has a troop option to take');
}

const troopType = option.troopEntries[0].troopType;

const sheet = armySheet({
  listName: 'Kish at dawn',
  armyList,
  selection: withGeneral(
    withStands(
      emptySelection({
        army: armyList.id,
        dataVersion: fixtureDataVersion,
        year: -2900,
      }),
      option,
      troopType,
      2,
    ),
    { option: option.id, troopType },
  ),
  costs: {
    troopTypes: troopTypeCosts(troopTypes),
    battleCards: sampleBattleCardCosts,
  },
  names: troopTypeNames(troopTypes),
  factors: troopTypeFactors(troopTypes),
  movement: troopTypeMovements(troopTypes),
  cardNames: {},
});

const openDialog = (onOpenChange = vi.fn()) => ({
  onOpenChange,
  ...renderUi(
    <>
      <CopyListDialog
        open
        sheet={sheet}
        siteUrl="https://triumph.example"
        onOpenChange={onOpenChange}
      />
      <Toaster />
    </>,
  ),
});

const preview = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'List text' });

afterEach(() => {
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('CopyListDialog', () => {
  it('shows the list as plain text to begin with', () => {
    openDialog();

    expect(preview().value).toContain('Kish at dawn');
    expect(preview().value).toContain('MAIN CONTINGENT');
    expect(preview().value).toContain('Chariots with 2 crew');
  });

  it('marks the list up when another format is chosen', async () => {
    const { user } = openDialog();

    await user.click(screen.getByRole('tab', { name: 'Markdown' }));
    expect(preview().value).toContain('# Kish at dawn');

    await user.click(screen.getByRole('tab', { name: 'BBCode' }));
    expect(preview().value).toContain('[b]Kish at dawn[/b]');
  });

  it('copies the format on show and closes', async () => {
    const written = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();
    const { user, onOpenChange } = openDialog();

    await user.click(screen.getByRole('tab', { name: 'Markdown' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(written).toHaveBeenCalledWith(
      expect.stringContaining('# Kish at dawn'),
    );
    expect(
      await screen.findByText('Kish at dawn copied as Markdown'),
    ).toBeVisible();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open and says so when the clipboard refuses', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('denied'),
    );
    const { user, onOpenChange } = openDialog();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(
      await screen.findByText(
        'The list could not be copied. Select the text and copy it yourself.',
      ),
    ).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
