import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import {
  type ActivityEvent,
  type EventActor,
  type EventOrigin,
  recordEvent,
} from '@/lib/db/activity-events';
import { insertArmy } from '@/lib/db/armies';
import { serveApi } from '@/test/api';
import { fixtureSelection } from '@/test/fixtures/army';
import { renderUi, type UiOptions } from '@/test/ui';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const api = serveApi();

const admin = 'user-scipio';

const hannibal: EventActor = { userId: admin, isAnonymous: false };

const browser: EventActor = { userId: 'user-browser', isAnonymous: true };

const carthage: EventOrigin = {
  ip: '203.0.113.7',
  location: { country: 'TN', region: 'Tunis', city: 'Carthage' },
};

const rome: EventOrigin = {
  ip: '2001:db8::1',
  location: { country: 'IT', region: 'Lazio', city: 'Rome' },
};

const record = (
  event: ActivityEvent,
  actor: EventActor | null,
  month: number,
  day: number,
  origin: EventOrigin = carthage,
) =>
  recordEvent(api.database(), {
    event,
    actor,
    origin,
    now: () => new Date(Date.UTC(2026, month - 1, day, 12)).toISOString(),
  });

const at = new Date(Date.UTC(2026, 8, 10)).toISOString();

const seedTotals = async () => {
  await api
    .database()
    .insertInto('users')
    .values([
      {
        id: 'user-browser',
        name: 'user-browser',
        email: 'user-browser@example.test',
        image: null,
        isAnonymous: 1,
      },
    ])
    .execute();
  const selection = fixtureSelection();
  for (const [id, userId] of [
    ['army-1', admin],
    ['army-2', admin],
    ['army-3', 'user-browser'],
  ] as const) {
    await insertArmy(api.database(), { id, userId, name: id, selection, at });
  }
};

const open = (options: UiOptions = {}) =>
  renderUi(<AdminDashboard />, { wrap: api.wrap, ...options });

const tile = async (name: string) =>
  within(await screen.findByRole('region', { name }));

const chart = async (name: string) => screen.findByRole('figure', { name });

beforeEach(async () => {
  await api.signInAsAdmin(admin);
});

describe('the admin dashboard', () => {
  it('tiles the totals, split by account and anonymous', async () => {
    await seedTotals();
    open();

    const players = await tile('Players');
    expect(players.getByText('2')).toBeInTheDocument();
    expect(
      players.getByText('1 with an account · 1 anonymous'),
    ).toBeInTheDocument();
    const lists = await tile('Saved lists');
    expect(lists.getByText('3')).toBeInTheDocument();
    expect(
      lists.getByText('2 with an account · 1 anonymous'),
    ).toBeInTheDocument();
    expect(
      (await tile('Shares')).getByText('0 with an account · 0 anonymous'),
    ).toBeInTheDocument();
    expect(
      (await tile('Collection entries')).getByText('0'),
    ).toBeInTheDocument();
  });

  it('charts the series and ranks the countries activity came from', async () => {
    await record({ kind: 'list.created' }, hannibal, 9, 10);
    await record({ kind: 'list.created' }, browser, 9, 12, rome);
    await record({ kind: 'list.edited' }, hannibal, 9, 12);
    await record(
      { kind: 'account.signed_in', props: { method: 'google' } },
      hannibal,
      9,
      14,
    );
    open();

    expect(await chart('Lists created')).toHaveTextContent('2 in range');
    expect(await chart('Lists edited')).toHaveTextContent('1 in range');
    expect(await chart('Sign-ins by method')).toHaveTextContent('1 in range');
    expect(await chart('Shares minted')).toHaveTextContent('0 in range');
    expect(
      screen.getByText(
        '20 August 2026 – 18 September 2026 · counted per day from the activity log.',
      ),
    ).toBeInTheDocument();
    const countries = screen.getByRole('region', { name: 'Countries' });
    expect(
      within(countries)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['CountryTunisiaEvents3', 'CountryItalyEvents1']);
    expect(
      within(screen.getByRole('region', { name: 'Cities' })).getByText(
        'Carthage, Tunis, Tunisia',
      ),
    ).toBeInTheDocument();
  });

  it('ranks the pages viewed and the filters chosen', async () => {
    const viewed = (route: string) =>
      ({ kind: 'page.viewed', props: { route } }) as const;
    const filtered = (key: string, value: string) =>
      ({ kind: 'filter.used', props: { key, value } }) as const;
    await record(viewed('/armies'), null, 9, 10);
    await record(viewed('/armies'), browser, 9, 11);
    await record(viewed('/armies/[id]/build'), hannibal, 9, 12);
    await record(filtered('armies.topography', 'Hilly'), null, 9, 12);
    await record(filtered('armies.topography', 'Hilly'), browser, 9, 13);
    await record(filtered('collection.status', 'painted'), hannibal, 9, 13);
    open();

    const pages = await screen.findByRole('region', { name: 'Top pages' });
    expect(
      within(pages)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Page/armiesViews2', 'Page/armies/[id]/buildViews1']);
    const filters = screen.getByRole('region', { name: 'Filters used' });
    expect(
      within(filters)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([
      'FilterArmy topographyValueHillyUses2',
      'FilterCollection statusValuepaintedUses1',
    ]);
  });

  it('says when nothing was viewed or filtered, while other activity shows', async () => {
    await record({ kind: 'list.created' }, hannibal, 9, 10);
    open();

    expect(
      await screen.findByText('No page views or filters'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Top pages' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the page and filter tables under the audience asked for', async () => {
    await record(
      { kind: 'page.viewed', props: { route: '/collection' } },
      hannibal,
      9,
      10,
    );
    await record(
      { kind: 'page.viewed', props: { route: '/armies' } },
      browser,
      9,
      10,
    );
    open({ searchParams: '?audience=anonymous' });

    const pages = await screen.findByRole('region', { name: 'Top pages' });
    expect(
      within(pages)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Page/armiesViews1']);
  });

  it('widens the range and keeps it in the URL', async () => {
    await record({ kind: 'list.created' }, hannibal, 9, 10);
    await record({ kind: 'list.created' }, hannibal, 7, 1);
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    expect(await chart('Lists created')).toHaveTextContent('1 in range');

    await user.click(screen.getByRole('button', { name: '90 days' }));

    expect(await screen.findByText(/counted per week/)).toBeInTheDocument();
    expect(await chart('Lists created')).toHaveTextContent('2 in range');
    expect(screen.getByRole('button', { name: '90 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('?range=90d');
  });

  it('narrows to one audience and keeps it in the URL', async () => {
    await seedTotals();
    await record({ kind: 'list.created' }, hannibal, 9, 10);
    await record({ kind: 'list.created' }, browser, 9, 11);
    await record({ kind: 'list.created' }, browser, 9, 12);
    const onUrlUpdate = vi.fn();
    const { user } = open({ onUrlUpdate });
    expect(await chart('Lists created')).toHaveTextContent('3 in range');

    await user.click(screen.getByRole('button', { name: 'Anonymous' }));

    expect(
      await (await tile('Saved lists')).findByText(
        '0 with an account · 1 anonymous',
      ),
    ).toBeInTheDocument();
    expect(await chart('Lists created')).toHaveTextContent('2 in range');
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe(
      '?audience=anonymous',
    );
  });

  it('reads the range and audience from the URL', async () => {
    await record({ kind: 'list.created' }, hannibal, 9, 10);
    await record({ kind: 'list.created' }, browser, 9, 17);
    open({ searchParams: '?range=7d&audience=anonymous' });

    expect(await chart('Lists created')).toHaveTextContent('1 in range');
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Anonymous' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('says when nothing happened, and offers the widest view', async () => {
    await record({ kind: 'list.created' }, hannibal, 1, 10);
    const onUrlUpdate = vi.fn();
    const { user } = open({ searchParams: '?audience=account', onUrlUpdate });

    expect(
      await screen.findByText('Nothing happened in this range'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Where players are' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Show 12 months of everyone' }),
    );

    expect(await chart('Lists created')).toHaveTextContent('1 in range');
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('?range=12m');
  });

  it('offers no wider view when it already shows the widest', async () => {
    open({ searchParams: '?range=12m' });

    expect(
      await screen.findByText('Nothing happened in this range'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show 12 months of everyone' }),
    ).not.toBeInTheDocument();
  });

  it('says when the usage did not load', async () => {
    api.fails('admin.stats');
    open();

    expect(await screen.findByText('Usage did not load')).toBeInTheDocument();
  });
});
