import type { Game } from './domain/game.ts';

export const routes = {
  home: '/',
  armies: '/armies',
  categories: '/categories',
  reference: '/reference',
  troopTypes: '/reference/troop-types',
  battleCards: '/reference/battle-cards',
  myArmies: '/my-armies',
  collection: '/collection',
  account: '/account',
  signIn: '/sign-in',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  admin: '/admin',
} as const;

export const armyUrl = (id: string) => `${routes.armies}/${id}`;

export const buildArmyUrl = (id: string) => `${armyUrl(id)}/build`;

export const gameBuilderUrl = (game: Game) => `/${game}/build`;

export const savedListUrl = ({ game, id }: { game: Game; id: string }) =>
  `${gameBuilderUrl(game)}?${new URLSearchParams({ list: id })}`;

export const draftListUrl = ({ game, code }: { game: Game; code: string }) =>
  `${gameBuilderUrl(game)}?${new URLSearchParams({ s: code })}`;

export const listViewUrl = (listId: string) =>
  `${routes.myArmies}/${encodeURIComponent(listId)}`;

export const unsavedListUrl = (code: string) =>
  `${routes.collection}/preview?${new URLSearchParams({ s: code })}`;

export const newCollectionEntryUrl = (troopType = '') =>
  `${routes.collection}?${new URLSearchParams({ new: troopType })}`;

export const sheetDispositions = ['attachment', 'inline'] as const;

export type SheetDisposition = (typeof sheetDispositions)[number];

export const listSheetUrl = ({
  code,
  name,
  share,
  lang,
  disposition = 'attachment',
}: {
  code: string;
  name?: string | undefined;
  share?: string | null | undefined;
  lang?: string | undefined;
  disposition?: SheetDisposition;
}) => {
  // ADR 0020 keeps this route sessionless, so it cannot read the cookie: the
  // language has to travel in the link.
  const params = new URLSearchParams({ s: code });
  if (lang) {
    params.set('lang', lang);
  }
  if (name) {
    params.set('name', name);
  }
  if (share) {
    params.set('share', share);
  }
  if (disposition !== 'attachment') {
    params.set('disposition', disposition);
  }
  return `/api/lists/sheet?${params}`;
};

export const sharedListUrl = (id: string) => `/s/${encodeURIComponent(id)}`;

export const categoryUrl = (id: string) => `${routes.categories}/${id}`;

export type IdRouteProps = {
  params: Promise<{ id: string }>;
};

export type SearchParams = Record<string, string | string[] | undefined>;

export type SearchParamsProps = {
  searchParams: Promise<SearchParams>;
};

export const onlyParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : null;

export type NavItem = {
  href: string;
  key:
    | 'armies'
    | 'categories'
    | 'reference'
    | 'myArmies'
    | 'collection'
    | 'admin';
};

export type LegalDocument = {
  href: string;
  key: 'privacy' | 'terms' | 'cookies';
};

export const primaryNavItems: readonly NavItem[] = [
  { href: routes.armies, key: 'armies' },
  { href: routes.categories, key: 'categories' },
  { href: routes.reference, key: 'reference' },
  { href: routes.myArmies, key: 'myArmies' },
  { href: routes.collection, key: 'collection' },
];

export const adminNavItem: NavItem = { href: routes.admin, key: 'admin' };

export const navItemsFor = (isAdmin: boolean): readonly NavItem[] =>
  isAdmin ? [...primaryNavItems, adminNavItem] : primaryNavItems;

export const isActiveRoute = (pathname: string, href: string) =>
  href === routes.home
    ? pathname === routes.home
    : pathname === href || pathname.startsWith(`${href}/`);

export const legalDocuments: readonly LegalDocument[] = [
  { href: routes.privacy, key: 'privacy' },
  { href: routes.terms, key: 'terms' },
  { href: routes.cookies, key: 'cookies' },
] as const;

export const externalLinks = {
  dbIp: 'https://db-ip.com',
  meshwesh: 'https://meshwesh.wgcwar.com',
  triumph: 'https://www.wgcwar.com',
  repository: 'https://github.com/dsaltares/triumph-army-builder',
  rules: 'https://www.wargamevault.com/en/product/196955/triumph-v1-2',
  setupQrs:
    'https://wgc-qrs.s3.us-east-2.amazonaws.com/Setting+Up+a+Game+QRS+v1-2.pdf',
  gameplayQrs:
    'https://wgc-qrs.s3.us-east-2.amazonaws.com/triumph-qrs-gameplay-v1-2.pdf',
} as const;
