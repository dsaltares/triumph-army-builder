import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArmyIndexView } from '@/components/army/army-index';
import { bundlePaths } from '@/lib/data/bundle';
import { serveApi } from '@/test/api';
import { sentBeacons } from '@/test/beacons';
import { armyIndexEntry } from '@/test/fixtures/army';
import { renderUi } from '@/test/ui';

const categories = [
  { id: 'cradle', name: 'Cradle of Civilization' },
  { id: 'iron', name: 'Iron Age Europe' },
];

const sumerian = armyIndexEntry({
  id: 'army-sumer',
  key: '1a',
  name: 'Goblin Warrens',
  keywords: ['Goblin'],
  startDate: -3000,
  endDate: -2800,
  invasion: [2],
  maneuver: [1],
  topographies: ['Arable'],
  categories: ['cradle'],
});

const armies = [
  sumerian,
  armyIndexEntry({
    id: 'army-gilgamesh',
    key: '1b',
    name: 'Gloomdeep Goblin Warrens',
    keywords: ['Goblin'],
    startDate: -2800,
    endDate: -2400,
    invasion: [2],
    maneuver: [2],
    topographies: ['Arable'],
    categories: ['cradle'],
  }),
  armyIndexEntry({
    id: 'army-gallic',
    key: '52a',
    name: 'Sylvan Courts',
    keywords: ['Elf'],
    startDate: -400,
    endDate: -50,
    invasion: [4],
    maneuver: [3],
    topographies: ['Hilly'],
    categories: ['iron'],
  }),
];

const meta = {
  source: 'https://meshwesh.example.test',
  fetchedAt: '2026-09-17T00:00:00.000Z',
  contentHash: 'abcdef01',
};

const api = serveApi({
  bundle: {
    [bundlePaths.index]: { meta, armies },
    [bundlePaths.thematicCategories]: categories,
  },
  translated: {
    es: {
      [bundlePaths.index]: {
        meta,
        armies: armies.map((army) =>
          army === sumerian ? { ...army, name: 'Sumerio temprano' } : army,
        ),
      },
    },
  },
});

const show = (
  ui: Parameters<typeof renderUi>[0],
  options: Parameters<typeof renderUi>[1] = {},
) => renderUi(ui, { wrap: api.wrap, ...options });

const openIndex = async (options: Parameters<typeof renderUi>[1] = {}) => {
  const rendered = show(<ArmyIndexView />, options);
  await screen.findByText('3 army lists');
  return rendered;
};

const search = () =>
  screen.getByRole('searchbox', { name: 'Search army lists' });

const listed = () =>
  screen
    .queryAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);

const openFilters = async (
  user: Awaited<ReturnType<typeof openIndex>>['user'],
) => {
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  await screen.findByRole('heading', { name: 'Filters' });
};

const chip = (group: string, label: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', {
    name: label,
  });

const apply = (user: Awaited<ReturnType<typeof openIndex>>['user']) =>
  user.click(screen.getByRole('button', { name: /^Show \d+ (army|armies)$/ }));

describe('the army index', () => {
  it('loads every army list', async () => {
    await openIndex();

    expect(listed()).toEqual([
      'Goblin Warrens',
      'Gloomdeep Goblin Warrens',
      'Sylvan Courts',
    ]);
  });

  it('re-reads the army names when the player changes language', async () => {
    const { changeLocale } = await openIndex();

    changeLocale('es');

    await waitFor(() => expect(listed()).toContain('Sumerio temprano'));
  });

  it('narrows the index by name', async () => {
    const { user } = await openIndex();

    await user.type(search(), 'gloomdeep');

    await waitFor(() =>
      expect(screen.getByText('1 of 3 army lists')).toBeInTheDocument(),
    );
    expect(listed()).toEqual(['Gloomdeep Goblin Warrens']);
  });

  it('narrows the index by keyword', async () => {
    const { user } = await openIndex();

    await user.type(search(), 'elf');

    await waitFor(() =>
      expect(screen.getByText('1 of 3 army lists')).toBeInTheDocument(),
    );
    expect(listed()).toEqual(['Sylvan Courts']);
  });

  it('says so when a search matches nothing, and undoes it', async () => {
    const { user } = await openIndex();

    await user.type(search(), 'zzzz');

    expect(await screen.findByText('No army list matches')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Clear search and filters' }),
    );

    expect(await screen.findByText('3 army lists')).toBeInTheDocument();
  });

  it('narrows by topography and rating, and counts the filters it holds', async () => {
    const { user } = await openIndex();

    await openFilters(user);
    await user.click(chip('Home topography', 'Hilly'));
    await user.click(chip('Invasion rating', '4'));
    await apply(user);

    expect(await screen.findByText('1 of 3 army lists')).toBeInTheDocument();
    expect(listed()).toEqual(['Sylvan Courts']);
    expect(
      screen.getByRole('button', { name: 'Filters 2' }),
    ).toBeInTheDocument();
  });

  it('reports each filter a player turns on, and nothing they search for', async () => {
    const { user } = await openIndex();

    await user.type(search(), 'sylvan');
    await openFilters(user);
    await user.click(chip('Home topography', 'Hilly'));
    await user.click(chip('Invasion rating', '4'));
    await apply(user);
    await screen.findByText('1 of 3 army lists');

    expect(sentBeacons().map(({ body }) => body)).toEqual([
      {
        kind: 'filter.used',
        props: { key: 'armies.topography', value: 'Hilly' },
      },
      { kind: 'filter.used', props: { key: 'armies.invasion', value: '4' } },
    ]);
  });

  it('keeps the armies whose span overlaps a date range', async () => {
    const { user } = await openIndex();

    await openFilters(user);
    await user.type(screen.getByLabelText('From'), '-2500');
    await user.type(screen.getByLabelText('To'), '-100');
    await apply(user);

    await waitFor(() =>
      expect(listed()).toEqual(['Gloomdeep Goblin Warrens', 'Sylvan Courts']),
    );
  });

  it('takes a thematic category as a filter of its own', async () => {
    const { user } = await openIndex();

    await openFilters(user);
    await user.click(
      screen.getByRole('checkbox', { name: 'Cradle of Civilization' }),
    );
    await apply(user);

    await waitFor(() =>
      expect(listed()).toEqual(['Goblin Warrens', 'Gloomdeep Goblin Warrens']),
    );
  });

  it('clears every filter at once', async () => {
    const { user } = await openIndex();

    await openFilters(user);
    await user.click(chip('Home topography', 'Hilly'));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await apply(user);

    expect(await screen.findByText('3 army lists')).toBeInTheDocument();
  });

  it('writes the filters it holds into the url', async () => {
    const onUrlUpdate = vi.fn();
    const { user } = await openIndex({ onUrlUpdate });

    await user.type(search(), 'goblin');
    await openFilters(user);
    await user.click(chip('Home topography', 'Arable'));
    await user.click(chip('Manoeuvre rating', '2'));

    await waitFor(() => {
      const latest = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams;
      expect(latest?.get('q')).toBe('goblin');
      expect(latest?.get('topography')).toBe('Arable');
      expect(latest?.get('manoeuvre')).toBe('2');
    });
  });

  it('opens on the armies a filtered url names', async () => {
    show(<ArmyIndexView />, { searchParams: '?q=gloomdeep' });

    await waitFor(() =>
      expect(screen.getByText('1 of 3 army lists')).toBeInTheDocument(),
    );
    expect(listed()).toEqual(['Gloomdeep Goblin Warrens']);
  });

  it('scopes itself to one category, and stops offering that filter', async () => {
    const { user } = show(<ArmyIndexView categoryId="cradle" />);

    expect(await screen.findByText('2 army lists')).toBeInTheDocument();
    expect(listed()).toEqual(['Goblin Warrens', 'Gloomdeep Goblin Warrens']);

    await openFilters(user);

    expect(
      screen.queryByRole('checkbox', { name: 'Cradle of Civilization' }),
    ).not.toBeInTheDocument();
  });

  it('says so when the index cannot be fetched', async () => {
    await api.missing(bundlePaths.index);

    show(<ArmyIndexView />);

    expect(
      await screen.findByText('The army lists could not be loaded'),
    ).toBeInTheDocument();
  });
});
