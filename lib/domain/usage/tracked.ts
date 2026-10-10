import { z } from 'zod';
import { topographies, troopTypeCodes } from '../../data/schema.ts';
import { ratingValues } from '../army-index.ts';
import { collectionStatuses } from '../collection/entry.ts';
import { gameSchema } from '../game.ts';

export const trackedRoutes = [
  '/account',
  '/admin',
  '/armies',
  '/armies/[id]',
  '/armies/[id]/build',
  '/categories',
  '/categories/[id]',
  '/collection',
  '/collection/preview',
  '/cookies',
  '/fantasy/battle-cards',
  '/fantasy/build',
  '/fantasy/troop-types',
  '/forgot-password',
  '/my-armies',
  '/my-armies/[id]',
  '/privacy',
  '/reference',
  '/reference/battle-cards',
  '/reference/troop-types',
  '/reset-password',
  '/s/[id]',
  '/sign-in',
  '/sign-up',
  '/terms',
  '/triumph/build',
] as const;

export type TrackedRoute = (typeof trackedRoutes)[number];

const dynamicSegment = /^\[[^\]]+\]$/;

const segmentsOf = (path: string) => path.split('/').filter(Boolean);

const matches = (template: string, segments: readonly string[]) => {
  const expected = segmentsOf(template);
  return (
    expected.length === segments.length &&
    expected.every(
      (segment, index) =>
        segment === segments[index] || dynamicSegment.test(segment),
    )
  );
};

const byStaticSegments = [...trackedRoutes].sort(
  (a, b) =>
    segmentsOf(b).filter((segment) => !dynamicSegment.test(segment)).length -
    segmentsOf(a).filter((segment) => !dynamicSegment.test(segment)).length,
);

export const routeTemplate = (pathname: string): TrackedRoute | null => {
  const segments = segmentsOf(pathname);
  return (
    byStaticSegments.find((template) => matches(template, segments)) ?? null
  );
};

const ratings = ratingValues.map(String) as [string, ...string[]];

const categoryId = z.string().regex(/^[0-9a-z-]{1,64}$/);

export const filterValueSchemas = {
  'armies.category': categoryId,
  'armies.topography': z.enum(topographies),
  'armies.invasion': z.enum(ratings),
  'armies.manoeuvre': z.enum(ratings),
  'collection.troopType': z.enum(troopTypeCodes),
  'collection.status': z.enum(collectionStatuses),
  'myArmies.game': gameSchema,
} satisfies Record<string, z.ZodType<string>>;

export type FilterKey = keyof typeof filterValueSchemas;

export const filterKeys = Object.keys(filterValueSchemas) as FilterKey[];

export type FilterUse = { key: FilterKey; value: string };

export const filterUseSchema = z
  .strictObject({ key: z.enum(filterKeys), value: z.string() })
  .refine(({ key, value }) => filterValueSchemas[key].safeParse(value).success);

export const usageEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('page.viewed'),
    props: z.strictObject({ route: z.enum(trackedRoutes) }),
  }),
  z.strictObject({ kind: z.literal('filter.used'), props: filterUseSchema }),
]);

export type UsageEvent = z.infer<typeof usageEventSchema>;

const chosenValues = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : [];

export const addedFilterValues = <Filters extends object>(
  keys: { readonly [Field in keyof Filters]?: FilterKey },
  before: Filters,
  after: { readonly [Field in keyof Filters]?: Filters[Field] | null },
): FilterUse[] =>
  (Object.entries(keys) as [keyof Filters, FilterKey | undefined][]).flatMap(
    ([field, key]) => {
      if (!key) {
        return [];
      }
      const previous = new Set(chosenValues(before[field]));
      return chosenValues(after[field])
        .filter((value) => !previous.has(value))
        .map((value) => ({ key, value }));
    },
  );
