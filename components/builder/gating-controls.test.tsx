import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GatingControls } from '@/components/builder/gating-controls';
import type { SubFactionGroup } from '@/lib/data/sub-factions';
import { buildArmyList } from '@/lib/domain/army/army-list';
import type { Gating } from '@/lib/domain/army/availability';
import { gatingEffect } from '@/lib/domain/army/builder';
import { troopTypeNames } from '@/lib/domain/troop-types';
import type { Locale } from '@/lib/i18n/routing';
import { allyContingent, armyDetail, troopOption } from '@/test/fixtures/army';
import { sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

const names = troopTypeNames(sampleTroopTypes);

const subFactions: SubFactionGroup = {
  army: 'Fixture Army',
  label: 'Sub-faction',
  variants: [
    { id: 'kish', name: 'Kish' },
    { id: 'other', name: 'Other city-states' },
  ],
  rules: { 'only Kish': { only: ['kish'] } },
};

const campaigns: SubFactionGroup = {
  army: 'Fixture Army',
  label: 'Campaign',
  variants: [
    { id: 'kish', name: 'At Kish', year: -2900 },
    { id: 'other', name: 'Any other campaign' },
  ],
  rules: { 'only Kish': { only: ['kish'] } },
};

const plain = buildArmyList(armyDetail());
const noted = buildArmyList(armyDetail({ subFactions }));
const dated = buildArmyList(armyDetail({ subFactions: campaigns }));
const unchanging = buildArmyList(
  armyDetail({
    troopOptions: [troopOption()],
    allyOptions: [],
    allyContingents: [],
  }),
);
const oneYear = buildArmyList(
  armyDetail({
    startDate: -2800,
    endDate: -2800,
    troopOptions: [troopOption()],
    allyOptions: [],
    allyContingents: [],
  }),
);

const twinAllies = buildArmyList(
  armyDetail({
    troopOptions: [troopOption()],
    allyOptions: [0, 1].map(() => ({
      allyEntries: [
        { allyArmyList: 'contingent-optional', name: 'Late friends' },
      ],
      dateRange: { startDate: -2950, endDate: -2800 },
      note: null,
    })),
    allyContingents: [allyContingent()],
  }),
);

const show = (
  armyList = plain,
  gating: Gating = { year: -2950, variant: null },
  handlers: {
    onYearChange?: (year: number) => void;
    onVariantChange?: (variant: string | null) => void;
  } = {},
  locale: Locale = 'en',
) =>
  renderUi(
    <GatingControls
      armyList={armyList}
      gating={gating}
      effect={gatingEffect(armyList, gating)}
      troopTypeNames={names}
      onYearChange={handlers.onYearChange ?? (() => {})}
      onVariantChange={handlers.onVariantChange ?? (() => {})}
    />,
    { locale },
  );

const track = () => screen.getByRole('slider', { name: 'Year' });

const press = async (
  user: ReturnType<typeof show>['user'],
  ...keys: string[]
) => {
  track().focus();
  for (const key of keys) {
    await user.keyboard(key);
  }
};

describe('GatingControls', () => {
  it('shows the chosen year beside its label', () => {
    show();

    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('2950 BC')).toBeInTheDocument();
  });

  it('spans the army with a slider, labelled in eras at both ends', () => {
    show();

    expect(track()).toHaveAttribute('min', '-3000');
    expect(track()).toHaveAttribute('max', '-2800');
    expect(track()).toHaveAttribute('aria-valuetext', '2950 BC');
    expect(screen.getByText('3000 BC')).toBeInTheDocument();
    expect(screen.getByText('2800 BC')).toBeInTheDocument();
  });

  it('says the track is marked where the army changes', () => {
    show();

    expect(
      screen.getByText('Marked where its options change.'),
    ).toBeInTheDocument();
  });

  it('says so, and offers no steps or timeline, for an army that never changes', () => {
    show(unchanging);

    expect(
      screen.getByText('Nothing in this list changes with the year.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Next change/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Timeline/ }),
    ).not.toBeInTheDocument();
  });

  it('gives an army that lasted one year the year, and no slider', () => {
    show(oneYear, { year: -2800, variant: null });

    expect(
      screen.queryByRole('slider', { name: 'Year' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('2800 BC')).toBeInTheDocument();
    expect(screen.queryByText(/changes with the year/)).not.toBeInTheDocument();
  });

  it('steps the slider a year at a time with the arrow keys', async () => {
    const onYearChange = vi.fn();
    const { user } = show(
      plain,
      { year: -2950, variant: null },
      { onYearChange },
    );

    await press(user, '{ArrowRight}', '{ArrowLeft}');

    expect(onYearChange.mock.calls).toEqual([[-2949], [-2951]]);
  });

  it('takes a larger jump on page up, and the ends on home and end', async () => {
    const onYearChange = vi.fn();
    const { user } = show(
      plain,
      { year: -2950, variant: null },
      { onYearChange },
    );

    await press(user, '{PageUp}', '{PageDown}', '{Home}', '{End}');

    expect(onYearChange.mock.calls).toEqual([
      [-2940],
      [-2960],
      [-3000],
      [-2800],
    ]);
  });

  it('parks the thumb at the nearest year it can reach, and says which', () => {
    show(plain, { year: 1415, variant: null });

    expect(track()).toHaveValue('-2800');
    expect(track()).toHaveAttribute(
      'aria-valuetext',
      '2800 BC, the nearest year to 1415 AD',
    );
  });

  it('names the period the year falls in, and how the list begins', () => {
    show();

    expect(screen.getByText('3000–2900 BC')).toBeInTheDocument();
    expect(screen.getByText('As the list begins')).toBeInTheDocument();
  });

  it('says what the period the year falls in gains and loses', () => {
    show(plain, { year: -2850, variant: null });

    expect(screen.getByText('2899–2800 BC')).toBeInTheDocument();
    expect(screen.getByText('Loses Archers or Bow Levy')).toBeInTheDocument();
  });

  it('says what a period loses in Spanish too', () => {
    show(plain, { year: -2850, variant: null }, {}, 'es');

    expect(screen.getByText(/^Pierde /)).toBeInTheDocument();
  });

  it('steps to the next change and back to the period before', async () => {
    const onYearChange = vi.fn();
    const { user } = show(
      plain,
      { year: -2850, variant: null },
      { onYearChange },
    );

    await user.click(
      screen.getByRole('button', { name: 'Previous period, from 3000 BC' }),
    );

    expect(onYearChange.mock.calls).toEqual([[-3000]]);
    expect(
      screen.getByRole('button', { name: 'No later change' }),
    ).toBeDisabled();
  });

  it('steps forward to the year the army next changes', async () => {
    const onYearChange = vi.fn();
    const { user } = show(
      plain,
      { year: -2950, variant: null },
      { onYearChange },
    );

    await user.click(
      screen.getByRole('button', { name: 'Next change, in 2899 BC' }),
    );

    expect(onYearChange.mock.calls).toEqual([[-2899]]);
    expect(
      screen.getByRole('button', { name: 'No earlier period' }),
    ).toBeDisabled();
  });

  it('keeps the timeline folded until asked for', async () => {
    const { user } = show();
    const toggle = screen.getByRole('button', {
      name: 'Timeline · 1 option changes with the year',
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: /^Archers or Bow Levy/ }),
    ).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', {
        name: 'Archers or Bow Levy offered in 2950 BC 3000–2900 BC',
      }),
    ).toBeInTheDocument();
  });

  it('draws one lane for contingents that share a name and their years', async () => {
    const { user } = show(twinAllies);

    await user.click(
      screen.getByRole('button', {
        name: 'Timeline · 1 option changes with the year',
      }),
    );

    expect(
      screen.getAllByRole('button', { name: /^Late friends/ }),
    ).toHaveLength(1);
  });

  it('moves the year to where a lane is offered when it is tapped', async () => {
    const onYearChange = vi.fn();
    const { user } = show(
      plain,
      { year: -2850, variant: null },
      { onYearChange },
    );

    await user.click(screen.getByRole('button', { name: /^Timeline/ }));
    await user.click(
      screen.getByRole('button', {
        name: 'Archers or Bow Levy not offered in 2850 BC 3000–2900 BC',
      }),
    );

    expect(onYearChange.mock.calls).toEqual([[-2900]]);
  });

  it('leaves the year alone when a lane already offered is tapped', async () => {
    const onYearChange = vi.fn();
    const { user } = show(
      plain,
      { year: -2950, variant: null },
      { onYearChange },
    );

    await user.click(screen.getByRole('button', { name: /^Timeline/ }));
    await user.click(
      screen.getByRole('button', { name: /^Archers or Bow Levy offered/ }),
    );

    expect(onYearChange).not.toHaveBeenCalled();
  });

  it('takes the year to a dated campaign when that campaign is chosen', async () => {
    const onYearChange = vi.fn();
    const onVariantChange = vi.fn();
    const { user } = show(
      dated,
      { year: -2950, variant: null },
      { onYearChange, onVariantChange },
    );

    expect(
      screen.getByText(/A dated one takes the year with it\.$/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'At Kish 2900 BC' }));

    expect(onVariantChange.mock.calls).toEqual([['kish']]);
    expect(onYearChange.mock.calls).toEqual([[-2900]]);
  });

  it('leaves the year alone when an undated campaign is chosen', async () => {
    const onYearChange = vi.fn();
    const { user } = show(
      dated,
      { year: -2950, variant: null },
      { onYearChange },
    );

    await user.click(
      screen.getByRole('button', { name: 'Any other campaign' }),
    );

    expect(onYearChange).not.toHaveBeenCalled();
  });

  it('leaves the year alone when a dated campaign is unchosen', async () => {
    const onYearChange = vi.fn();
    const onVariantChange = vi.fn();
    const { user } = show(
      dated,
      { year: -2950, variant: 'kish' },
      { onYearChange, onVariantChange },
    );

    await user.click(screen.getByRole('button', { name: 'At Kish 2900 BC' }));

    expect(onVariantChange.mock.calls).toEqual([[null]]);
    expect(onYearChange).not.toHaveBeenCalled();
  });

  it('says when the army was not around in the chosen year', () => {
    show(plain, { year: 1415, variant: null });

    expect(screen.getByText('1415 AD')).toBeInTheDocument();
    expect(
      screen.getByText(/This army was not around in 1415 AD/),
    ).toBeInTheDocument();
  });

  it('asks nothing when the army declares no sub-faction', () => {
    show();

    expect(screen.queryByText('Sub-faction')).not.toBeInTheDocument();
  });

  it('asks the sub-faction question the army carries', () => {
    show(noted);

    expect(screen.getByText('Sub-faction')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kish' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Other city-states' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Pick a sub-faction/)).toBeInTheDocument();
  });

  it('answers the sub-faction question, and takes the answer back', async () => {
    const onVariantChange = vi.fn();
    const { user } = show(
      noted,
      { year: -2950, variant: 'kish' },
      { onVariantChange },
    );

    await user.click(screen.getByRole('button', { name: 'Kish' }));
    await user.click(screen.getByRole('button', { name: 'Other city-states' }));

    expect(onVariantChange.mock.calls).toEqual([[null], ['other']]);
  });

  it('marks the chosen sub-faction and stops asking', () => {
    show(noted, { year: -2950, variant: 'kish' });

    expect(screen.getByRole('button', { name: 'Kish' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(/^Pick a sub-faction/)).not.toBeInTheDocument();
  });

  it('keeps asking when the variant is not one the army declares', () => {
    show(noted, { year: -2950, variant: 'umma' });

    expect(screen.getByText(/^Pick a sub-faction/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kish' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
