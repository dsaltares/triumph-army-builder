import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autosaveQuietMs } from '@/components/builder/use-autosave';
import { FantasyBuilder } from '@/components/fantasy/fantasy-builder';
import { FantasyBuilderActions } from '@/components/fantasy/fantasy-builder-actions';
import { FantasyBuilderStateProvider } from '@/components/fantasy/fantasy-builder-state';
import { FantasyListTitle } from '@/components/fantasy/fantasy-list-title';
import { insertArmy, listArmies } from '@/lib/db/armies';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import { serveApi } from '@/test/api';
import { asSignedIn } from '@/test/auth-client';
import { cards, fantasySelection, fantasyUnit } from '@/test/fixtures/fantasy';
import samplePack from '@/test/fixtures/reference/sample-pack.json';
import { renderUi } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));
vi.mock('@/lib/auth/client', () => import('@/test/auth-client'));

const api = serveApi({
  bundle: Object.fromEntries(
    samplePack.locales.en.map(({ path, contents }) => [path, contents]),
  ),
});

const owner = 'user-hannibal';

const builderPage = (draft: FantasySelection | null = null) => (
  <FantasyBuilderStateProvider>
    <FantasyListTitle />
    <FantasyBuilderActions />
    <FantasyBuilder draft={draft} />
  </FantasyBuilderStateProvider>
);

const openBuilder = async (
  searchParams = '',
  draft: FantasySelection | null = null,
) => {
  const rendered = renderUi(builderPage(draft), {
    wrap: api.wrap,
    searchParams,
  });
  await screen.findByRole('heading', { name: 'Units', level: 2 });
  return rendered;
};

type User = Awaited<ReturnType<typeof openBuilder>>['user'];

const ancestor = (element: HTMLElement, selector: string) => {
  const found = element.closest(selector);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`nothing matching ${selector} holds ${element.tagName}`);
  }
  return found;
};

const section = (name: string) =>
  within(ancestor(screen.getByRole('heading', { name, level: 2 }), 'section'));

const unitNames = () =>
  section('Units')
    .queryAllByRole('textbox', { name: 'Unit name' })
    .map(
      (input) =>
        (input as HTMLInputElement).value || input.getAttribute('placeholder'),
    );

const unitCard = (index = 0) => {
  const input = section('Units').getAllByRole('textbox', { name: 'Unit name' })[
    index
  ];
  if (!input) {
    throw new Error(`there is no unit ${index}`);
  }
  return within(ancestor(input, 'li'));
};

const pick = async (user: User, trigger: HTMLElement, option: string) => {
  await user.click(trigger);
  const dialog = within(await screen.findByRole('dialog'));
  await user.click(
    dialog.getByRole('button', { name: new RegExp(`^${option}`) }),
  );
};

const addUnit = (user: User, troopType: string) =>
  pick(
    user,
    section('Units').getByRole('button', { name: 'Add unit' }),
    troopType,
  );

const total = () =>
  screen
    .getAllByRole('status')
    .find((status) => status.textContent?.includes('/ '));

const saveStatus = () => screen.getByRole('status', { name: 'Save status' });

const settlesTo = (text: string) =>
  waitFor(() => expect(saveStatus()).toHaveTextContent(text), {
    timeout: autosaveQuietMs * 3,
  });

const storedSelection = async () => {
  const [list] = await listArmies(api.database(), owner);
  if (list?.game !== 'fantasy') {
    throw new Error('no Fantasy Triumph list was stored');
  }
  return list.selection;
};

beforeEach(async () => {
  vi.setSystemTime(new Date(2026, 9, 9, 9, 30));
  asSignedIn({ id: owner });
  await api.signIn(owner);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the format', () => {
  it('opens at the pack’s points total, with both ratings unpaid', async () => {
    await openBuilder();

    expect(screen.getByRole('textbox', { name: 'List name' })).toHaveValue(
      'Fantasy Triumph · 9 October 2026',
    );
    expect(
      screen.getByRole('spinbutton', { name: 'Points total' }),
    ).toHaveValue(51);
    expect(total()).toHaveTextContent('0/ 51');
    expect(
      section('Format').getByRole('button', { name: 'Arable', pressed: true }),
    ).toBeInTheDocument();
  });

  it('prices the ratings as they step, and says what a dense topography costs', async () => {
    const { user } = await openBuilder();
    const format = section('Format');

    await user.click(
      format.getByRole('button', { name: 'Raise the Invasion rating' }),
    );
    await user.click(
      format.getByRole('button', { name: 'Lower the Manoeuvre rating' }),
    );

    expect(format.getByText('Gives back ½')).toBeInTheDocument();
    expect(format.getByText('Gives back 1')).toBeInTheDocument();
    expect(total()).toHaveTextContent('-1½');

    await user.click(format.getByRole('button', { name: 'Dense Forest' }));

    expect(
      format.getByText(
        'Dense Forest is dense, so Ambush, Prepared Defenses, Terrain Affinity cost more.',
      ),
    ).toBeInTheDocument();
  });

  it('plays at the points total the player types', async () => {
    const { user } = await openBuilder();
    const field = screen.getByRole('spinbutton', { name: 'Points total' });

    await user.clear(field);
    await user.type(field, '36');

    expect(total()).toHaveTextContent('0/ 36');
  });
});

describe('a unit', () => {
  it('is added by its troop type, priced, and leads the army as the first one', async () => {
    const { user } = await openBuilder();

    await addUnit(user, 'Javelin Cavalry');

    expect(unitNames()).toEqual(['Javelin Cavalry']);
    expect(
      unitCard().getByText('Javelin Cavalry · 1 stand at 4 · costs 4'),
    ).toBeInTheDocument();
    expect(total()).toHaveTextContent('4/ 51');
    expect(
      section('General').getByRole('radio', { name: 'Javelin Cavalry' }),
    ).toBeChecked();
  });

  it('offers troop types grouped by category and order', async () => {
    const { user } = await openBuilder();

    await user.click(
      section('Units').getByRole('button', { name: 'Add unit' }),
    );
    const dialog = within(await screen.findByRole('dialog'));

    expect(
      within(dialog.getByRole('region', { name: 'Mounted · close order' }))
        .getAllByRole('button')
        .map((option) => option.firstChild?.textContent),
    ).toEqual(['Cataphracts', 'Behemoths']);
  });

  it('takes a name, tags and stands', async () => {
    const { user } = await openBuilder();
    await addUnit(user, 'Javelin Cavalry');
    const card = unitCard();

    await user.type(
      card.getByRole('textbox', { name: 'Unit name' }),
      'Warg riders',
    );
    await user.type(card.getByRole('combobox', { name: 'Tags' }), 'wolf,');
    await user.keyboard('{Escape}');
    await user.click(
      card.getByRole('button', { name: 'One more stand of Warg riders' }),
    );

    expect(
      section('General').getByRole('radio', { name: 'Warg riders' }),
    ).toBeChecked();
    expect(card.getByText('wolf')).toBeInTheDocument();
    expect(total()).toHaveTextContent('8/ 51');
  });

  it('offers only the cards it may take, and prices the ones it buys', async () => {
    const { user } = await openBuilder();
    await addUnit(user, 'War Wagons');
    const card = unitCard();

    await user.click(card.getByRole('button', { name: 'Add card' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.queryByRole('button', { name: /^Fierce/ }),
    ).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: /^Flying/ }));

    expect(card.getByText('Flying')).toBeInTheDocument();
    expect(card.getByText('Priced by the choice you make')).toBeInTheDocument();

    await user.click(card.getByRole('button', { name: 'Zoom Flying' }));

    expect(
      card.getByRole('button', { name: 'Zoom Flying', pressed: true }),
    ).toBeInTheDocument();
    expect(card.getByText('+2 a stand')).toBeInTheDocument();
    expect(total()).toHaveTextContent('5/ 51');

    await user.click(
      card.getByRole('button', { name: 'Remove Flying from War Wagons' }),
    );

    expect(card.queryByText('Flying')).not.toBeInTheDocument();
    expect(total()).toHaveTextContent('3/ 51');
  });

  it('asks Terrain Affinity which terrains it favours', async () => {
    const { user } = await openBuilder();
    await addUnit(user, 'Light Foot');
    const card = unitCard();

    await pick(
      user,
      card.getByRole('button', { name: 'Add card' }),
      'Terrain Affinity',
    );
    await user.type(
      card.getByRole('textbox', { name: 'Terrain Affinity note' }),
      'Hills, woods',
    );

    expect(
      card.getByRole('textbox', { name: 'Terrain Affinity note' }),
    ).toHaveValue('Hills, woods');
    expect(total()).toHaveTextContent('3½/ 51');
  });

  it('splits some of its stands into a new unit with the same cards', async () => {
    const { user } = await openBuilder(
      '',
      fantasySelection({
        units: [
          fantasyUnit('wargs', 'JCV', {
            name: 'Warg riders',
            stands: 3,
            cards: cards('fierce'),
          }),
        ],
        general: 'wargs',
      }),
    );

    await user.click(unitCard().getByRole('button', { name: 'Split' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Split off 1 stand' }));

    expect(unitNames()).toEqual(['Warg riders', 'Warg riders']);
    expect(
      unitCard(0).getByText('Javelin Cavalry · 2 stands at 3½ · costs 7'),
    ).toBeInTheDocument();
    expect(
      unitCard(1).getByText('Javelin Cavalry · 1 stand at 3½ · costs 3½'),
    ).toBeInTheDocument();
    expect(unitCard(1).getByText('Fierce')).toBeInTheDocument();
  });

  it('cannot split a single stand', async () => {
    const { user } = await openBuilder();
    await addUnit(user, 'Javelin Cavalry');

    expect(unitCard().getByRole('button', { name: 'Split' })).toBeDisabled();
  });

  it('is removed, and the list falls back to its empty state', async () => {
    const { user } = await openBuilder();
    await addUnit(user, 'Javelin Cavalry');

    await user.click(
      unitCard().getByRole('button', { name: 'Remove Javelin Cavalry' }),
    );

    expect(section('Units').getByText('No units yet')).toBeInTheDocument();
    expect(total()).toHaveTextContent('0/ 51');
    expect(
      section('General').getByText('Add a unit to choose the general.'),
    ).toBeInTheDocument();
  });
});

describe('heroes', () => {
  it('are added up to the pack’s cap of three', async () => {
    const { user } = await openBuilder();
    const heroes = section('Heroes');

    for (let added = 0; added < 3; added += 1) {
      await user.click(heroes.getByRole('button', { name: 'Add hero' }));
    }

    expect(heroes.getAllByRole('textbox', { name: 'Hero name' })).toHaveLength(
      3,
    );
    expect(heroes.getByRole('button', { name: 'Add hero' })).toBeDisabled();
    expect(
      heroes.getByText('The army has all 3 of its heroes'),
    ).toBeInTheDocument();
    expect(total()).toHaveTextContent('3/ 51');
    expect(
      section('General').queryByRole('radio', { name: /Hero/ }),
    ).not.toBeInTheDocument();
  });

  it('takes a name, hero cards and Delayed Entry, and leaves when removed', async () => {
    const { user } = await openBuilder();
    const heroes = section('Heroes');
    await user.click(heroes.getByRole('button', { name: 'Add hero' }));

    await user.type(
      heroes.getByRole('textbox', { name: 'Hero name' }),
      'Shaman',
    );
    await pick(
      user,
      heroes.getByRole('button', { name: 'Add card' }),
      'Champion',
    );
    await user.click(
      heroes.getByRole('checkbox', { name: 'On Delayed Entry' }),
    );

    expect(heroes.getByText('Costs 2 with its cards')).toBeInTheDocument();
    expect(total()).toHaveTextContent('0/ 51');

    await user.click(heroes.getByRole('button', { name: 'Remove Shaman' }));

    expect(
      heroes.queryByRole('textbox', { name: 'Hero name' }),
    ).not.toBeInTheDocument();
  });
});

describe('army cards', () => {
  it('are bought with a count and a choice', async () => {
    const { user } = await openBuilder();
    const army = section('Army cards');

    await pick(
      user,
      army.getByRole('button', { name: 'Add army card' }),
      'Illusion',
    );
    await user.click(army.getByRole('button', { name: 'One more Illusion' }));
    await pick(
      user,
      army.getByRole('button', { name: 'Add army card' }),
      'Ambush',
    );
    await user.click(army.getByRole('button', { name: 'Any topography' }));

    expect(total()).toHaveTextContent('4/ 51');
  });
});

describe('validation', () => {
  it('reports the list against the format', async () => {
    await openBuilder();

    expect(
      section('Validation').getByText(
        'A 51-point army needs at least 8 stands, 0 stands selected',
      ),
    ).toBeInTheDocument();
    expect(
      section('Validation').getByText(
        'One unit in the army must be the general',
      ),
    ).toBeInTheDocument();
  });
});

describe('saving', () => {
  it('saves a draft as a Fantasy Triumph list, then keeps every change', async () => {
    const { user } = await openBuilder();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await settlesTo('Saved');
    await addUnit(user, 'Javelin Cavalry');
    await settlesTo('Saved');

    expect((await storedSelection()).units).toEqual([
      expect.objectContaining({ troopType: 'JCV', stands: 1 }),
    ]);
  });

  it('reopens a saved list as it was left', async () => {
    await insertArmy(api.database(), {
      id: 'saved-1',
      userId: owner,
      name: 'Goblin raid',
      game: 'fantasy',
      selection: fantasySelection({
        units: [
          fantasyUnit('wargs', 'JCV', { name: 'Warg riders', stands: 4 }),
        ],
        general: 'wargs',
      }),
      at: '2026-10-09T08:00:00.000Z',
    });

    await openBuilder('?list=saved-1');

    expect(screen.getByRole('textbox', { name: 'List name' })).toHaveValue(
      'Goblin raid',
    );
    expect(unitNames()).toEqual(['Warg riders']);
    expect(total()).toHaveTextContent('16/ 51');
  });
});
