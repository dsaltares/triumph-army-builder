import { describe, expect, it } from 'vitest';
import {
  armyUrl,
  buildArmyUrl,
  categoryUrl,
  draftListUrl,
  gameBuilderUrl,
  isActiveRoute,
  legalDocuments,
  listSheetUrl,
  primaryNavItems,
  routes,
  savedListUrl,
} from './navigation.ts';

describe('isActiveRoute', () => {
  it('marks the route itself as active', () => {
    expect(isActiveRoute('/armies', routes.armies)).toBe(true);
  });

  it('marks a nested route as active', () => {
    expect(isActiveRoute('/armies/66c', routes.armies)).toBe(true);
  });

  it('does not mark a route that merely shares a prefix', () => {
    expect(isActiveRoute('/armies-of-old', routes.armies)).toBe(false);
  });

  it('keeps a reference sub-page inside the reference section', () => {
    expect(isActiveRoute(routes.troopTypes, routes.reference)).toBe(true);
    expect(isActiveRoute(routes.battleCards, routes.reference)).toBe(true);
  });

  it('does not mark a sibling route as active', () => {
    expect(isActiveRoute('/reference', routes.armies)).toBe(false);
  });

  it('marks home as active only on home itself', () => {
    expect(isActiveRoute('/', routes.home)).toBe(true);
    expect(isActiveRoute('/armies', routes.home)).toBe(false);
  });
});

describe('primaryNavItems', () => {
  it('points every item at a known route', () => {
    const known = new Set<string>(Object.values(routes));

    for (const { href } of primaryNavItems) {
      expect(known.has(href)).toBe(true);
    }
  });
});

describe('legalDocuments', () => {
  it('points every document at a known route', () => {
    const known = new Set<string>(Object.values(routes));

    for (const { href } of legalDocuments) {
      expect(known.has(href), `${href} is not a route`).toBe(true);
    }
  });

  it('keeps every document off the primary nav', () => {
    const primary = new Set(primaryNavItems.map(({ href }) => href));

    for (const { href } of legalDocuments) {
      expect(primary.has(href)).toBe(false);
    }
  });
});

describe('armyUrl', () => {
  it('addresses an army under the index', () => {
    expect(armyUrl('66c')).toBe('/armies/66c');
  });
});

describe('gameBuilderUrl', () => {
  it('addresses the builder of a game under its name', () => {
    expect(gameBuilderUrl('triumph')).toBe('/triumph/build');
  });

  it('addresses a saved list in the builder of its game', () => {
    expect(savedListUrl({ game: 'triumph', id: 'army 1' })).toBe(
      '/triumph/build?list=army+1',
    );
  });

  it('addresses an unsaved list in the builder of its game', () => {
    expect(draftListUrl({ game: 'triumph', code: '2.ab_c-d' })).toBe(
      '/triumph/build?s=2.ab_c-d',
    );
  });
});

describe('buildArmyUrl', () => {
  it('addresses the builder under the army it builds', () => {
    expect(buildArmyUrl('66c')).toBe('/armies/66c/build');
  });
});

describe('categoryUrl', () => {
  it('addresses one thematic category', () => {
    expect(categoryUrl('5fb1b71fe1af060017701922')).toBe(
      '/categories/5fb1b71fe1af060017701922',
    );
  });
});

describe('listSheetUrl', () => {
  it('addresses the sheet of whatever list the code describes', () => {
    expect(listSheetUrl({ code: '1.abcd' })).toBe('/api/lists/sheet?s=1.abcd');
  });

  it('names the download after the list when it has a name', () => {
    expect(
      listSheetUrl({
        code: '1.abcd',
        name: 'Cannae rematch',
      }),
    ).toBe('/api/lists/sheet?s=1.abcd&name=Cannae+rematch');
  });

  it('leaves the name out of an unsaved list', () => {
    expect(listSheetUrl({ code: '1.abcd', name: '' })).toBe(
      '/api/lists/sheet?s=1.abcd',
    );
  });

  it('carries the short link the sheet puts in its QR code', () => {
    expect(
      listSheetUrl({
        code: '1.abcd',
        share: 'Ab3xK9_mQ1zT',
      }),
    ).toBe('/api/lists/sheet?s=1.abcd&share=Ab3xK9_mQ1zT');
  });

  it('exports without a QR code when no short link could be made', () => {
    expect(listSheetUrl({ code: '1.abcd', share: null })).toBe(
      '/api/lists/sheet?s=1.abcd',
    );
  });

  it('asks for the sheet inline when it is to be previewed', () => {
    expect(
      listSheetUrl({
        code: '1.abcd',
        disposition: 'inline',
      }),
    ).toBe('/api/lists/sheet?s=1.abcd&disposition=inline');
  });

  it('leaves a download unmarked, since that is what the route serves', () => {
    expect(
      listSheetUrl({
        code: '1.abcd',
        disposition: 'attachment',
      }),
    ).toBe('/api/lists/sheet?s=1.abcd');
  });
});
