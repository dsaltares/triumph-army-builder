import { screen, within } from '@testing-library/react';
import type { OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArmyBuilderView } from '@/components/builder/army-builder-view';
import { BuilderActions } from '@/components/builder/builder-actions';
import { BuilderStateProvider } from '@/components/builder/builder-state';
import { Toaster } from '@/components/ui/sonner';
import type { ArmyDetail } from '@/lib/data/bundle';
import { insertCollectionEntry } from '@/lib/db/collection';
import { buildArmyList } from '@/lib/domain/army/army-list';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeMovements,
  troopTypeNames,
  troopTypeProfiles,
} from '@/lib/domain/troop-types';
import { serveApi } from '@/test/api';
import { asSignedIn, asSignedOut } from '@/test/auth-client';
import { builderArmyDetail, fixtureDataVersion } from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi();

const troopTypes = sampleTroopTypes;
const costs = {
  troopTypes: troopTypeCosts(troopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(troopTypes);
const factors = troopTypeFactors(troopTypes);
const profiles = troopTypeProfiles(troopTypes);

const openBuilder = (
  detail: ArmyDetail = builderArmyDetail(),
  searchParams = '',
  onUrlUpdate?: OnUrlUpdateFunction,
) =>
  renderUi(
    <ArmyBuilderView
      dataVersion={fixtureDataVersion}
      armyList={buildArmyList(detail)}
      costs={costs}
      names={names}
      factors={factors}
      movement={troopTypeMovements(troopTypes)}
      profiles={profiles}
    />,
    {
      searchParams,
      wrap: (children) =>
        api.wrap(
          <BuilderStateProvider>
            <BuilderActions />
            {children}
            <Toaster />
          </BuilderStateProvider>,
        ),
      ...(onUrlUpdate ? { onUrlUpdate } : {}),
    },
  );

const ancestor = (element: HTMLElement, selector: string) => {
  const found = element.closest(selector);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`nothing matching ${selector} holds ${element.tagName}`);
  }
  return found;
};

const section = (name: string) =>
  ancestor(screen.getByRole('heading', { name, level: 2 }), 'section');

const troops = () => within(section('Required Troops'));
const generalChip = () =>
  screen.getByRole('button', { name: / — show general$/ });
const general = () => within(screen.getByRole('dialog'));
const validation = () => within(section('Validation'));

const troopCard = (description: string) =>
  within(ancestor(troops().getByText(description), 'li'));

const contingentCard = (name: string) =>
  within(ancestor(screen.getByRole('switch', { name }), 'li'));

const allyCard = (name: string) =>
  within(ancestor(screen.getByRole('radio', { name }), 'li'));

const cardGroup = (title: string) =>
  within(
    ancestor(
      within(section('Battle cards')).getByRole('heading', {
        name: title,
        level: 3,
      }),
      'li',
    ),
  );

const meter = () => screen.getByRole('progressbar');

const yearSlider = () => screen.getByRole('slider', { name: 'Year' });

const stands = (scope: ReturnType<typeof within>, name: string) =>
  scope.getByLabelText(`${name} stands`, { exact: true });

const toFirstYear = async (user: ReturnType<typeof renderUi>['user']) => {
  yearSlider().focus();
  await user.keyboard('{Home}');
};

describe('the gating controls drive the whole view', () => {
  it('opens on an empty army with the whole cap to spend', () => {
    openBuilder();

    expect(screen.getByText('48 left')).toBeInTheDocument();
    expect(screen.getByText('Stands 0 · Battle cards 0')).toBeInTheDocument();
    expect(meter()).toHaveAttribute(
      'aria-valuetext',
      '0 of 48 points, 48 left',
    );
  });

  it('drags the year along the slider, and writes it into the url', async () => {
    const onUrlUpdate = vi.fn();
    const { user } = openBuilder(builderArmyDetail(), '', onUrlUpdate);

    expect(yearSlider()).toHaveValue('-3000');

    yearSlider().focus();
    await user.keyboard('{ArrowRight}');

    expect(yearSlider()).toHaveValue('-2999');
    expect(yearSlider()).toHaveAttribute('aria-valuetext', '2999 BC');
    expect(screen.getByText('2999 BC')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('year')).toBe(
        '-2999',
      ),
    );
  });

  it('opens on the year and the sub-faction a shared link carries', () => {
    openBuilder(builderArmyDetail(), '?year=-2900&variant=kish');

    expect(yearSlider()).toHaveValue('-2900');
    expect(screen.getByRole('button', { name: 'Kish' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('withholds the options that name a sub-faction until one is picked', async () => {
    const { user } = openBuilder();

    expect(screen.getByText(/^Pick a sub-faction/)).toBeInTheDocument();
    expect(troops().queryByText('Noble knights')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kish' }));

    expect(screen.queryByText(/^Pick a sub-faction/)).not.toBeInTheDocument();
    expect(
      troopCard('Noble knights').getByText(/^0 of 0–4 stands/),
    ).toBeInTheDocument();
  });

  it('leaves the stands an option holds when the year turns against it', async () => {
    const { user } = openBuilder(builderArmyDetail(), '?year=-2850');

    await user.click(
      troopCard('Seasonal raiders').getByRole('button', {
        name: 'One more Raiders stand',
      }),
    );
    await toFirstYear(user);

    const withheld = troopCard('Seasonal raiders');
    expect(withheld.getByText('Not offered in this year')).toBeInTheDocument();
    expect(stands(withheld, 'Raiders')).toHaveTextContent('1');
    expect(screen.getByText('Stands 4 · Battle cards 0')).toBeInTheDocument();
  });
});

describe('a choice in one section reaches the others', () => {
  it('moves the points meter when a troop option is filled', async () => {
    const { user } = openBuilder();
    const more = troopCard('Chariots with 2 crew').getByRole('button', {
      name: 'One more Chariots stand',
    });

    await user.click(more);
    await user.click(more);

    expect(
      stands(troopCard('Chariots with 2 crew'), 'Chariots'),
    ).toHaveTextContent('2');
    expect(screen.getByText('Stands 8 · Battle cards 0')).toBeInTheDocument();
    expect(screen.getByText('40 left')).toBeInTheDocument();
  });

  it('brings a contingent’s troop options in with it, and its points', async () => {
    const { user } = openBuilder();

    expect(
      contingentCard('Optional friends').queryByRole('button', {
        name: 'One more Light Foot stand',
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Optional friends' }));

    const taken = contingentCard('Optional friends');
    await user.click(
      taken.getByRole('button', { name: 'One more Light Foot stand' }),
    );
    await user.click(
      taken.getByRole('button', { name: 'One more Light Foot stand' }),
    );

    expect(
      screen.getByText(/^1 of 4 taken · 2 stands · 6 points from optional/),
    ).toBeInTheDocument();
    expect(screen.getByText('Stands 6 · Battle cards 0')).toBeInTheDocument();
  });

  it('takes a dropped contingent’s stands away with it', async () => {
    const { user } = openBuilder();

    await user.click(screen.getByRole('switch', { name: 'Town militia' }));
    await user.click(
      contingentCard('Town militia').getByRole('button', {
        name: 'One more Horde stand',
      }),
    );

    expect(screen.getByText('Stands 2 · Battle cards 0')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Town militia' }));

    expect(screen.getByText('Stands 0 · Battle cards 0')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Town militia' }));

    expect(stands(contingentCard('Town militia'), 'Horde')).toHaveTextContent(
      '0',
    );
  });

  it('counts an ally’s stands apart from the rest of the army', async () => {
    const { user } = openBuilder();

    await user.click(screen.getByRole('radio', { name: 'Allied horse' }));
    await user.click(
      allyCard('Allied horse').getByRole('button', {
        name: 'One more Horse Bow stand',
      }),
    );

    expect(
      screen.getByText(/^Allied horse · 1 stand · 4 points from the ally/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Stands 4 · Battle cards 0 · 4 allied'),
    ).toBeInTheDocument();
  });

  it('replaces the first ally with the second, stands and all', async () => {
    const { user } = openBuilder();

    await user.click(screen.getByRole('radio', { name: 'Allied horse' }));
    await user.click(
      allyCard('Allied horse').getByRole('button', {
        name: 'One more Horse Bow stand',
      }),
    );
    await user.click(screen.getByRole('radio', { name: 'Allied foot' }));

    expect(
      screen.getByText(/^Allied foot · 0 stands · 0 points from the ally/),
    ).toBeInTheDocument();
    expect(screen.getByText('Stands 0 · Battle cards 0')).toBeInTheDocument();
  });

  it('offers the general on the rows of the stands the army has taken', async () => {
    const { user } = openBuilder();

    expect(generalChip()).toHaveAccessibleName('No general yet — show general');

    await user.click(
      troopCard('Hill and marsh dwellers').getByRole('button', {
        name: 'One more Light Foot stand',
      }),
    );

    expect(
      troopCard('Hill and marsh dwellers').queryByRole('button', {
        name: /as general/,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'One more Chariots stand',
      }),
    );
    await user.click(generalChip());

    expect(
      general().getByText(/1 of 2 stands can lead the army/),
    ).toBeInTheDocument();
  });

  it('never offers an allied stand as the general, but offers a contingent one', async () => {
    const { user } = openBuilder(builderArmyDetail(), '?variant=kish');

    await user.click(screen.getByRole('switch', { name: 'Town militia' }));
    await user.click(
      contingentCard('Town militia').getByRole('button', {
        name: 'One more Horde stand',
      }),
    );
    await user.click(screen.getByRole('radio', { name: 'Allied horse' }));
    await user.click(
      allyCard('Allied horse').getByRole('button', {
        name: 'One more Horse Bow stand',
      }),
    );
    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'One more Chariots stand',
      }),
    );

    expect(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'Chariots as general',
      }),
    ).toBeInTheDocument();
    expect(
      allyCard('Allied horse').queryByRole('button', { name: /as general/ }),
    ).not.toBeInTheDocument();

    await user.click(generalChip());

    expect(
      general().queryByRole('button', { name: /Horse Bow/ }),
    ).not.toBeInTheDocument();
    expect(
      general().getByText(/1 of 3 stands can lead the army/),
    ).toBeInTheDocument();
  });

  it('names the general from its row, and stands it down when the option is emptied', async () => {
    const { user } = openBuilder();
    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'One more Chariots stand',
      }),
    );
    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'Chariots as general',
      }),
    );

    expect(generalChip()).toHaveAccessibleName(
      'General: Chariots — show general',
    );

    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'One fewer Chariots stand',
      }),
    );

    expect(generalChip()).toHaveAccessibleName('No general yet — show general');
  });

  it('names the general from the chip, and marks its row', async () => {
    const { user } = openBuilder();
    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'One more Chariots stand',
      }),
    );
    await user.click(generalChip());
    await user.click(
      general().getByRole('button', {
        name: 'Chariots from Chariots with 2 crew',
      }),
    );

    expect(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'Chariots as general',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens a troop option’s cards once the option holds stands', async () => {
    const { user } = openBuilder();
    const shooting = () => cardGroup('Chariots');

    expect(
      shooting().getByRole('button', {
        name: 'One more Shower Shooting purchase',
      }),
    ).toBeDisabled();

    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'One more Chariots stand',
      }),
    );

    expect(
      shooting().getByText('Put on the 1 stand this option holds.'),
    ).toBeInTheDocument();

    await user.click(
      shooting().getByRole('button', {
        name: 'One more Shower Shooting purchase',
      }),
    );

    expect(screen.getByText('Stands 4 · Battle cards 1')).toBeInTheDocument();
  });

  it('takes points off the meter for a card that makes a stand cheaper', async () => {
    const { user } = openBuilder(builderArmyDetail(), '?variant=kish');

    await user.click(
      troopCard('Noble knights').getByRole('button', {
        name: 'One more Knights stand',
      }),
    );
    await user.click(
      cardGroup('Knights').getByRole('button', {
        name: 'One more Sword-Fighting Cavalry purchase',
      }),
    );

    expect(screen.getByText('Stands 4 · Battle cards -½')).toBeInTheDocument();
    expect(meter()).toHaveAttribute(
      'aria-valuetext',
      '3½ of 48 points, 44½ left',
    );
  });
});

describe('the validation panel reads the army as it stands', () => {
  it('is on the page from the first render, with the verdict in the meter', () => {
    openBuilder();

    expect(validation().getByRole('status')).toHaveTextContent(
      /Illegal\s*\d+ errors/,
    );
    expect(
      screen.getByRole('button', { name: /^Illegal, .* show validation$/ }),
    ).toBeInTheDocument();
    expect(
      validation().getByText('One stand in the army must be the general'),
    ).toBeInTheDocument();
  });

  it('takes a finding off the panel once it is answered', async () => {
    const { user } = openBuilder();

    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'One more Chariots stand',
      }),
    );
    await user.click(
      troopCard('Chariots with 2 crew').getByRole('button', {
        name: 'Chariots as general',
      }),
    );

    expect(
      validation().queryByText('One stand in the army must be the general'),
    ).not.toBeInTheDocument();
    expect(
      validation().getByText(
        /Chariots needs at least 2 stands, 1 stand selected/,
      ),
    ).toBeInTheDocument();
  });
});

describe('the can i build it sheet reads the draft as it stands', () => {
  afterEach(asSignedOut);

  it('follows a stepper change into the coverage of the collection', async () => {
    await api.signIn('user-hannibal');
    asSignedIn({ id: 'user-hannibal' });
    await insertCollectionEntry(api.database(), {
      id: 'entry-chariots',
      userId: 'user-hannibal',
      at: '2026-09-20T10:00:00.000Z',
      name: 'Royal chariots',
      count: 3,
      troopType: 'CHT',
      tags: [],
      status: 'painted',
      notes: '',
    });
    const { user } = openBuilder();
    const canIBuildIt = async () => {
      await user.click(screen.getByRole('button', { name: 'List actions' }));
      await user.click(
        await screen.findByRole('menuitem', { name: 'Can I build it?' }),
      );
    };

    await canIBuildIt();
    const before = within(await screen.findByRole('dialog'));
    expect(
      await before.findByText(
        'This list has no stands yet, so there is nothing to cover.',
      ),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    const more = troopCard('Chariots with 2 crew').getByRole('button', {
      name: 'One more Chariots stand',
    });
    await user.click(more);
    await user.click(more);
    await canIBuildIt();

    const after = within(await screen.findByRole('dialog'));
    expect(await after.findByText('Royal chariots × 2')).toBeInTheDocument();
  });
});

describe('randomize draws a whole army into the view', () => {
  it('fills the meter with a legal list, and undoes back to the one before', async () => {
    const { user } = openBuilder();

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Randomize' }),
    );

    expect(meter()).toHaveAttribute(
      'aria-valuetext',
      '48 of 48 points, Full army',
    );
    expect(
      screen.getByRole('button', { name: /^Legal\b/ }),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(meter()).toHaveAttribute(
      'aria-valuetext',
      '0 of 48 points, 48 left',
    );
  });
});
