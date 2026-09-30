import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArmyDetailView } from '@/components/army/army-detail';
import type { ArmyDetail } from '@/lib/data/bundle';
import type { BattleCardNames } from '@/lib/domain/battle-cards/listing';
import type { RelatedArmies } from '@/lib/domain/related-armies';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeNames,
  troopTypeProfiles,
} from '@/lib/domain/troop-types';
import {
  armyDetail,
  battleCardEntry,
  related,
  relatedArmy,
  troopOption,
} from '@/test/fixtures/army';
import { sampleTroopTypes, withRulebookValues } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const troopTypes = sampleTroopTypes.map(withRulebookValues);

const battleCardNames: BattleCardNames = {
  FC: 'Fortified Camp',
  HL: 'Hold the Line',
};

const show = (
  detail: ArmyDetail = armyDetail(),
  relatedArmies: RelatedArmies = related(),
) =>
  renderUi(
    <ArmyDetailView
      detail={detail}
      related={relatedArmies}
      troopTypeNames={troopTypeNames(troopTypes)}
      troopTypeCosts={troopTypeCosts(troopTypes)}
      troopTypeFactors={troopTypeFactors(troopTypes)}
      troopTypeProfiles={troopTypeProfiles(troopTypes)}
      battleCardNames={battleCardNames}
    />,
  );

describe('ArmyDetailView', () => {
  it('lays the army out in the three rulebook sections', () => {
    show();

    for (const title of [
      'Required Troops',
      'Optional Contingents',
      'Ally Troop Options',
    ]) {
      expect(
        screen.getByRole('heading', { name: title, level: 2 }),
      ).toBeInTheDocument();
    }
  });

  it('labels the troop option fields the way the rulebook heads its columns', () => {
    show();

    for (const heading of [
      'Stands',
      'Troop type',
      'Battle line',
      'Description',
      'Battle cards',
    ]) {
      expect(
        screen.getAllByText(heading, { selector: 'dt' }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('names the troop types a free mix draws from', () => {
    show();

    const troopTypes = screen
      .getAllByText('Troop type', { selector: 'dt' })
      .map((label) => label.nextElementSibling?.textContent);

    expect(troopTypes).toContain('Archers or Bow Levy');
  });

  it('opens the profile of each troop type an option draws from', async () => {
    const { user } = show();

    await user.click(screen.getByRole('button', { name: 'Bow Levy factors' }));

    const profile = within(
      await screen.findByRole('dialog', { name: 'Bow Levy' }),
    );
    expect(
      profile.getByText('Open order foot · 2 points per stand'),
    ).toBeInTheDocument();
    expect(profile.getByText('40×30 · 60×40 · 80×60')).toBeInTheDocument();
    expect(profile.getByText('3 per stand')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Archers factors' }),
    ).toBeInTheDocument();
  });

  it('marks the battle line, half included', () => {
    show();

    const lines = screen
      .getAllByText('Battle line', { selector: 'dt' })
      .map((label) => label.nextElementSibling?.textContent);

    expect(lines).toContain('All');
    expect(lines).toContain('Half');
    expect(lines).toContain('—');
  });

  it('tags an option with the years and the sub-faction it depends on', () => {
    show();

    expect(screen.getByText('3000–2900 BC')).toBeInTheDocument();
    expect(screen.getByText('only Kish')).toBeInTheDocument();
  });

  it('shows the army ratings, topography and general', () => {
    show();

    expect(screen.getByText('Invasion rating')).toBeInTheDocument();
    expect(screen.getByText('Arable')).toBeInTheDocument();
    expect(screen.getByText('Spear or Knights')).toBeInTheDocument();
  });

  it('carries battle cards at both scopes, with their allowance', () => {
    show();

    const cells = screen
      .getAllByText('Battle cards', { selector: 'dt' })
      .map((label) => label.nextElementSibling?.textContent);

    expect(cells).toContain('Hold the Line 0–2');
    expect(screen.getByText('Fortified Camp')).toBeInTheDocument();
  });

  it('offers an optional contingent without the pair that repeats it', () => {
    show();

    expect(screen.getByText('Optional friends')).toBeInTheDocument();
    expect(screen.queryByText('Bundled ally')).not.toBeInTheDocument();
    expect(
      screen.getByText('No ally troop options available.'),
    ).toBeInTheDocument();
  });

  it('asks the sub-faction question when the army has one', () => {
    show(
      armyDetail({
        subFactions: {
          army: 'Fixture Army',
          label: 'Sub-faction',
          variants: [
            { id: 'kish', name: 'Kish' },
            { id: 'other', name: 'Other city-states' },
          ],
          rules: { 'only Kish': { only: ['kish'] } },
        },
      }),
    );

    expect(screen.getByText('Kish or Other city-states')).toBeInTheDocument();
  });

  it('says so when an army is offered no contingents at all', () => {
    show(armyDetail({ allyOptions: [], allyContingents: [] }));

    expect(
      screen.getByText('No optional contingents available.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No ally troop options available.'),
    ).toBeInTheDocument();
  });

  it('takes both halves of a bundled ally option together', () => {
    show(
      armyDetail({
        allyOptions: [
          {
            allyEntries: [
              { allyArmyList: 'contingent-ally', name: 'Steppe allies' },
              { allyArmyList: 'contingent-other', name: 'City allies' },
            ],
            dateRange: null,
            note: null,
          },
        ],
        allyContingents: [
          ...armyDetail().allyContingents,
          {
            id: 'contingent-other',
            name: 'Fixture City Contingent',
            internalContingent: false,
            dateRange: null,
            troopOptions: [troopOption({ min: 1, max: 2 })],
          },
        ],
      }),
    );

    expect(
      screen.getByText('Steppe allies and City allies'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/each stays a contingent of its own/),
    ).toBeInTheDocument();
  });

  it('says when a contingent offers nothing in the years it covers', () => {
    show(
      armyDetail({
        allyOptions: [
          {
            allyEntries: [
              { allyArmyList: 'contingent-optional', name: 'Optional friends' },
            ],
            dateRange: null,
            note: null,
          },
        ],
        allyContingents: [
          {
            id: 'contingent-optional',
            name: 'Fixture Optional Contingent',
            internalContingent: true,
            dateRange: null,
            troopOptions: [],
          },
        ],
      }),
    );

    expect(
      screen.getByText('No troop options in the years this list covers.'),
    ).toBeInTheDocument();
  });

  it('says when the army itself is offered no battle cards', () => {
    show(
      armyDetail({
        battleCardEntries: [],
        troopOptions: [troopOption({ battleCardEntries: [battleCardEntry()] })],
      }),
    );

    expect(
      screen.getByText('No battle cards are offered to this army as a whole.'),
    ).toBeInTheDocument();
  });

  it('links each enemy to its own list', () => {
    show();

    expect(screen.getByRole('link', { name: /Fixture Rival/ })).toHaveAttribute(
      'href',
      '/armies/army-2',
    );
    expect(screen.getByText('1b · 2900–2700 BC')).toBeInTheDocument();
  });

  it('names the numbered list the sub-lists share', () => {
    show();

    expect(
      screen.getByText(/The other sub-lists of list 1/),
    ).toBeInTheDocument();
  });

  it('leaves an army not matched against itself unremarked', () => {
    show();

    expect(
      screen.queryByText('This army is also matched against itself.'),
    ).not.toBeInTheDocument();
  });

  it('says when an army is matched against itself', () => {
    show(armyDetail(), related({ facesItself: true }));

    expect(
      screen.getByText('This army is also matched against itself.'),
    ).toBeInTheDocument();
  });

  it('says when an army has no enemies and no sub-lists', () => {
    show(armyDetail(), related({ enemies: [], sublists: [] }));

    expect(
      screen.getByText('No enemies are listed for this army.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('This army is the only sub-list of its number.'),
    ).toBeInTheDocument();
  });

  it('links the other sub-lists of the same numbered list', () => {
    show(
      armyDetail(),
      related({
        sublists: [
          relatedArmy({ id: 'army-3', key: '1c', name: 'Fixture Heir' }),
        ],
      }),
    );

    expect(screen.getByRole('link', { name: /Fixture Heir/ })).toHaveAttribute(
      'href',
      '/armies/army-3',
    );
  });
});
