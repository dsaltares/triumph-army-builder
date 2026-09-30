import type { ResponseMetaFn } from '@trpc/server/http';
import type { AppRouter } from './root.ts';

const referencePath = /^reference\./;

export const pinnedReferenceCache = 'public, max-age=31536000, immutable';

export const currentReferenceCache =
  'public, max-age=60, stale-while-revalidate=300';

const pinsDataVersion = (input: unknown) =>
  typeof input === 'object' &&
  input !== null &&
  'dataVersion' in input &&
  typeof input.dataVersion === 'string';

export const responseMeta: ResponseMetaFn<AppRouter> = ({
  info,
  type,
  errors,
  eagerGeneration,
}) => {
  const calls = info?.calls ?? [];
  const cacheable =
    type === 'query' &&
    !eagerGeneration &&
    errors.length === 0 &&
    calls.length > 0 &&
    calls.every(({ path }) => referencePath.test(path));
  if (!cacheable) {
    return {};
  }
  return {
    headers: {
      'cache-control': calls.every((call) => pinsDataVersion(call.result()))
        ? pinnedReferenceCache
        : currentReferenceCache,
    },
  };
};
