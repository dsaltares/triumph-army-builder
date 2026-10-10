import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autosaveQuietMs } from '@/components/builder/use-autosave';
import { FantasyBuilder } from '@/components/fantasy/fantasy-builder';
import { FantasyBuilderActions } from '@/components/fantasy/fantasy-builder-actions';
import { FantasyBuilderStateProvider } from '@/components/fantasy/fantasy-builder-state';
import { FantasyListTitle } from '@/components/fantasy/fantasy-list-title';
import { insertArmy, listArmies } from '@/lib/db/armies';
import { insertCollectionEntry } from '@/lib/db/collection';
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

const chooseTroopType = async (
  user: User,
  combobox: HTMLElement,
  troopType: string,
) => {
  await user.click(combobox);
  await user.type(combobox, troopType);
  await user.click(
    await screen.findByRole('option', { name: new RegExp(` · ${troopType}$`) }),
  );
};

const pendingTroopType = () => {
  const comboboxes = section('Units').getAllByRole('combobox', {
    name: 'Troop type',
  });
  const last = comboboxes[comboboxes.length - 1];
  if (!last) {
    throw new Error('there is no unit waiting for a troop type');
  }
  return last;
};

const addUnit = async (user: User, troopType: string) => {
  await user.click(section('Units').getByRole('button', { name: 'Add unit' }));
  await chooseTroopType(user, pendingTroopType(), troopType);
};

const pointsTotalField = () =>
  screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Points total' });

const total = () => {
  const status = pointsTotalField().closest('[role="status"]');
  return `${status?.querySelector('span')?.textContent}/ ${pointsTotalField().value}`;
};

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
    expect(pointsTotalField()).toHaveValue(51);
    expect(total()).toContain('0/ 51');
    expect(
      section('Format').getByRole('combobox', { name: 'Home topography' }),
    ).toHaveValue('Arable');
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
    expect(total()).toContain('-1½');

    const topography = format.getByRole('combobox', {
      name: 'Home topography',
    });
    await user.clear(topography);
    await user.type(topography, 'dense f');
    await user.click(
      await screen.findByRole('option', { name: 'Dense Forest' }),
    );

    expect(
      format.getByText(
        'Dense Forest is dense, so Ambush, Prepared Defenses, Terrain Affinity cost more.',
      ),
    ).toBeInTheDocument();
  });

  it('plays at the points total the player types in the points bar', async () => {
    const { user } = await openBuilder();
    const field = pointsTotalField();

    expect(
      section('Format').queryByRole('spinbutton', { name: 'Points total' }),
    ).not.toBeInTheDocument();

    await user.clear(field);
    await user.type(field, '36');

    expect(total()).toContain('0/ 36');
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
    expect(total()).toContain('4/ 51');
    expect(
      section('General').getByRole('radio', { name: 'Javelin Cavalry' }),
    ).toBeChecked();
  });

  it('starts as a card with no troop type, joining the list once one is picked', async () => {
    const { user } = await openBuilder();

    await user.click(
      section('Units').getByRole('button', { name: 'Add unit' }),
    );
    await user.type(
      section('Units').getByRole('textbox', { name: 'Unit name' }),
      'Warg riders',
    );

    const troopType = pendingTroopType();
    expect(troopType).toHaveValue('');
    expect(total()).toContain('0/ 51');

    await user.click(troopType);

    expect(
      screen.getByRole('option', { name: 'RBL · Rabble' }),
    ).toBeInTheDocument();

    await chooseTroopType(user, troopType, 'Javelin Cavalry');

    expect(unitNames()).toEqual(['Warg riders']);
    expect(total()).toContain('4/ 51');
    expect(
      section('General').getByRole('radio', { name: 'Warg riders' }),
    ).toBeChecked();
  });

  it('names the general from the points bar too', async () => {
    const { user } = await openBuilder(
      '',
      fantasySelection({
        units: [
          fantasyUnit('wargs', 'JCV', { name: 'Warg riders' }),
          fantasyUnit('archers', 'ARC', { name: 'Goblin archers' }),
        ],
        general: null,
      }),
    );

    await user.click(
      screen.getByRole('button', { name: 'No general yet — show general' }),
    );
    const picker = within(await screen.findByRole('dialog'));
    await user.click(picker.getByRole('radio', { name: 'Goblin archers' }));

    expect(
      await screen.findByRole('button', {
        name: 'General: Goblin archers — show general',
      }),
    ).toBeInTheDocument();
    expect(
      section('General').getByRole('radio', { name: 'Goblin archers' }),
    ).toBeChecked();
  });

  it('discards a card left without a troop type', async () => {
    const { user } = await openBuilder();

    await user.click(
      section('Units').getByRole('button', { name: 'Add unit' }),
    );
    await user.click(
      section('Units').getByRole('button', { name: 'Discard this unit' }),
    );

    expect(section('Units').getByText('No units yet')).toBeInTheDocument();
  });

  it('changes its troop type in place', async () => {
    const { user } = await openBuilder();
    await addUnit(user, 'Javelin Cavalry');
    const troopType = unitCard().getByRole('combobox', { name: 'Troop type' });

    await user.clear(troopType);
    await chooseTroopType(user, troopType, 'Light Foot');

    expect(
      unitCard().getByText('Light Foot · 1 stand at 3 · costs 3'),
    ).toBeInTheDocument();
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
    expect(total()).toContain('8/ 51');
  });

  it('suggests tags from the names in the list', async () => {
    const { user } = await openBuilder(
      '',
      fantasySelection({
        units: [
          fantasyUnit('wargs', 'JCV', { name: 'Zorbrak wolf riders' }),
          fantasyUnit('archers', 'ARC'),
        ],
      }),
    );
    const card = unitCard(1);

    await user.type(card.getByRole('combobox', { name: 'Tags' }), 'zor');

    expect(
      await screen.findByRole('option', { name: 'zorbrak' }),
    ).toBeInTheDocument();
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
    expect(card.getByText('+2 per stand')).toBeInTheDocument();
    expect(total()).toContain('5/ 51');

    await user.click(
      card.getByRole('button', { name: 'Remove Flying from War Wagons' }),
    );

    expect(card.queryByText('Flying')).not.toBeInTheDocument();
    expect(total()).toContain('3/ 51');
  });

  it('narrows the offered cards to a search, across every group', async () => {
    const { user } = await openBuilder();
    await addUnit(user, 'War Wagons');
    const card = unitCard();

    await user.click(card.getByRole('button', { name: 'Add card' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Search cards'), 'fly');

    expect(dialog.getByRole('button', { name: /^Flying/ })).toBeVisible();
    expect(
      dialog.queryByRole('button', { name: /^Armored/ }),
    ).not.toBeInTheDocument();

    await user.clear(dialog.getByLabelText('Search cards'));
    await user.type(dialog.getByLabelText('Search cards'), 'zzz');

    expect(
      dialog.getByText('No card offered here answers to that search.'),
    ).toBeVisible();

    await user.keyboard('{Escape}');
    await user.click(card.getByRole('button', { name: 'Add card' }));

    expect(
      within(await screen.findByRole('dialog')).getByLabelText('Search cards'),
    ).toHaveValue('');
  });

  it('counts event cards and marked stands among its cards', async () => {
    const { user } = await openBuilder(
      '',
      fantasySelection({
        units: [fantasyUnit('spears', 'SPR', { name: 'Spears', stands: 3 })],
        general: 'spears',
      }),
    );
    const card = unitCard();

    await pick(
      user,
      card.getByRole('button', { name: 'Add card' }),
      'Hold the Line',
    );
    await user.click(
      card.getByRole('button', { name: 'One more Hold the Line for Spears' }),
    );
    await pick(
      user,
      card.getByRole('button', { name: 'Add card' }),
      'Delayed Entry',
    );
    await user.click(
      card.getByRole('button', { name: 'One more delayed stand of Spears' }),
    );

    expect(card.getByText('2 cards for the unit')).toBeInTheDocument();
    expect(card.getByText('2 of 3 stands')).toBeInTheDocument();
    expect(total()).toContain('9/ 51');

    await user.click(card.getByRole('button', { name: 'Add card' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.queryByRole('button', { name: /^Hold the Line/ }),
    ).not.toBeInTheDocument();
    expect(
      dialog.queryByRole('button', { name: /^Delayed Entry/ }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(
      card.getByRole('button', { name: 'Remove Delayed Entry from Spears' }),
    );

    expect(card.queryByText('2 of 3 stands')).not.toBeInTheDocument();
    expect(total()).toContain('13/ 51');
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
    expect(total()).toContain('3½/ 51');
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
    expect(total()).toContain('0/ 51');
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
    expect(total()).toContain('3/ 51');
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
    expect(total()).toContain('0/ 51');

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

    expect(total()).toContain('4/ 51');
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

  it('asks once for a card’s choices, and stops asking once every one is made', async () => {
    const { user } = await openBuilder();
    const heroes = section('Heroes');
    await user.click(heroes.getByRole('button', { name: 'Add hero' }));
    await user.type(
      heroes.getByRole('textbox', { name: 'Hero name' }),
      'Wizard',
    );
    await pick(
      user,
      heroes.getByRole('button', { name: 'Add card' }),
      'Spellblast',
    );
    const unchosen = () =>
      section('Validation').queryAllByText(
        'Spellblast for Wizard has no choice made',
      );

    expect(unchosen()).toHaveLength(1);

    await user.click(
      heroes.getByRole('button', { name: 'Limited Spellblast' }),
    );

    expect(unchosen()).toHaveLength(1);

    await user.click(heroes.getByRole('button', { name: 'Physical' }));

    expect(unchosen()).toHaveLength(0);
  });
});

describe('can I build it', () => {
  it('covers the list as it stands with the player’s collection', async () => {
    await insertCollectionEntry(api.database(), {
      id: 'entry-wolves',
      userId: owner,
      at: '2026-10-09T08:00:00.000Z',
      name: 'Wolf pack',
      count: 4,
      troopType: 'JCV',
      tags: ['wolf'],
      games: ['fantasy'],
      status: 'painted',
      notes: '',
    });
    const { user } = await openBuilder(
      '',
      fantasySelection({
        units: [
          fantasyUnit('wargs', 'JCV', {
            name: 'Warg riders',
            tags: ['wolf'],
            stands: 2,
          }),
        ],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'List actions' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Can I build it?' }),
    );

    const sheet = within(
      await screen.findByRole('dialog', { name: 'Can I build it?' }),
    );
    expect(await sheet.findByText('Wolf pack × 2')).toBeInTheDocument();
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
    expect(total()).toContain('16/ 51');
  });
});

const openSavedGoblins = async () => {
  await insertArmy(api.database(), {
    id: 'saved-1',
    userId: owner,
    name: 'Goblin raid',
    game: 'fantasy',
    selection: fantasySelection({
      units: [fantasyUnit('wargs', 'JCV', { name: 'Warg riders', stands: 4 })],
      general: 'wargs',
    }),
    at: '2026-10-09T08:00:00.000Z',
  });
  const rendered = await openBuilder('?list=saved-1');
  await rendered.user.click(
    screen.getByRole('button', { name: 'List actions' }),
  );
  return rendered;
};

describe('exporting', () => {
  it('shares the list as a Fantasy Triumph copy behind a short link', async () => {
    const { user } = await openSavedGoblins();

    await user.click(screen.getByRole('menuitem', { name: 'Share link' }));

    const link = await within(
      screen.getByRole('dialog'),
    ).findByLabelText<HTMLInputElement>('Link');
    expect(link.value).toMatch(/\/s\/[\w-]{12}$/);
    expect(
      await api
        .database()
        .selectFrom('shares')
        .select(['game', 'army_list_id', 'name'])
        .execute(),
    ).toEqual([{ game: 'fantasy', army_list_id: null, name: 'Goblin raid' }]);
  });

  it('copies the list as text, unit by unit', async () => {
    const { user } = await openSavedGoblins();

    await user.click(screen.getByRole('menuitem', { name: 'Copy as text…' }));

    expect(
      within(screen.getByRole('dialog')).getByRole<HTMLTextAreaElement>(
        'textbox',
      ).value,
    ).toContain('Warg riders — 4 × Javelin Cavalry · General · 16 points');
  });

  it('offers the PDF, the saved view and the collection check together', async () => {
    await openSavedGoblins();

    expect(
      screen.getByRole('menuitem', { name: 'Download PDF' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'View list' })).toHaveAttribute(
      'href',
      '/my-armies/saved-1',
    );
    expect(
      screen.getByRole('menuitem', { name: 'Can I build it?' }),
    ).toBeInTheDocument();
  });
});
