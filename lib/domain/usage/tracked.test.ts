import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addedFilterValues,
  filterUseSchema,
  routeTemplate,
  trackedRoutes,
  usageEventSchema,
} from './tracked.ts';

const siteDirectory = join(process.cwd(), 'app', '[locale]', '(site)');

const pagesUnder = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pagesUnder(join(directory, entry.name))
      : entry.name === 'page.tsx'
        ? [`/${relative(siteDirectory, directory).split(sep).join('/')}`]
        : [],
  );

describe('trackedRoutes', () => {
  it('is every page the site serves', () => {
    expect([...trackedRoutes].sort()).toEqual(pagesUnder(siteDirectory).sort());
  });
});

describe('routeTemplate', () => {
  it.each([
    ['/armies', '/armies'],
    ['/armies/', '/armies'],
    ['/armies/5fb1b71fe1af060017701922', '/armies/[id]'],
    ['/armies/5fb1b71fe1af060017701922/build', '/armies/[id]/build'],
    ['/collection/preview', '/collection/preview'],
    ['/my-armies/list-1', '/my-armies/[id]'],
    ['/s/abc123', '/s/[id]'],
  ])('names %s as %s', (pathname, template) => {
    expect(routeTemplate(pathname)).toBe(template);
  });

  it('prefers a named page over an id in the same place', () => {
    expect(routeTemplate('/reference/troop-types')).toBe(
      '/reference/troop-types',
    );
  });

  it.each(['/', '/no/such/page', '/armies/one/two'])(
    'names nothing for %s',
    (pathname) => {
      expect(routeTemplate(pathname)).toBeNull();
    },
  );
});

describe('usageEventSchema', () => {
  it('takes a route template and a known filter', () => {
    expect(
      usageEventSchema.safeParse({
        kind: 'page.viewed',
        props: { route: '/armies/[id]' },
      }).success,
    ).toBe(true);
    expect(
      usageEventSchema.safeParse({
        kind: 'filter.used',
        props: { key: 'collection.status', value: 'painted' },
      }).success,
    ).toBe(true);
  });

  it.each([
    { kind: 'page.viewed', props: { route: '/armies/5fb1b71fe1af06' } },
    { kind: 'page.viewed', props: { route: '/armies?q=gallic' } },
    { kind: 'page.viewed', props: { route: 'https://example.test/armies' } },
    { kind: 'filter.used', props: { key: 'armies.search', value: 'gallic' } },
    { kind: 'filter.used', props: { key: 'collection.tag', value: 'mine' } },
    { kind: 'filter.used', props: { key: 'armies.invasion', value: '9' } },
    { kind: 'filter.used', props: { key: 'armies.category', value: 'A B' } },
    { kind: 'list.created', props: {} },
    {
      kind: 'page.viewed',
      props: { route: '/armies', url: 'https://example.test' },
    },
  ])('refuses %j', (event) => {
    expect(usageEventSchema.safeParse(event).success).toBe(false);
  });
});

describe('filterUseSchema', () => {
  it('checks the value against the filter it names', () => {
    expect(
      filterUseSchema.safeParse({ key: 'armies.topography', value: 'Hilly' })
        .success,
    ).toBe(true);
    expect(
      filterUseSchema.safeParse({ key: 'armies.topography', value: 'painted' })
        .success,
    ).toBe(false);
  });
});

describe('addedFilterValues', () => {
  const keys = {
    topographies: 'armies.topography',
    invasion: 'armies.invasion',
  } as const;

  const none = {
    search: '',
    topographies: [] as string[],
    invasion: [] as number[],
  };

  it('names every value the change turns on', () => {
    expect(
      addedFilterValues(keys, none, {
        ...none,
        topographies: ['Hilly', 'Dry'],
        invasion: [4],
      }),
    ).toEqual([
      { key: 'armies.topography', value: 'Hilly' },
      { key: 'armies.topography', value: 'Dry' },
      { key: 'armies.invasion', value: '4' },
    ]);
  });

  it('leaves out what was already on, what went off and what it does not track', () => {
    const before = { ...none, topographies: ['Hilly'], invasion: [4] };

    expect(
      addedFilterValues(keys, before, {
        search: 'gallic',
        topographies: ['Hilly'],
        invasion: [],
      }),
    ).toEqual([]);
  });

  it('names nothing for a field the change clears', () => {
    expect(addedFilterValues(keys, none, { topographies: null })).toEqual([]);
  });
});
