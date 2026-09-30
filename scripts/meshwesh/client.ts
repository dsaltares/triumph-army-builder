import { describeError } from '../../lib/errors.ts';

export type JsonRecord = Record<string, unknown>;

export type FetchLike = (url: string) => Promise<Response>;

export type MeshweshClientOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  concurrency?: number;
  attempts?: number;
  retryDelayMs?: number;
};

export type FetchProgress = (fetched: number, total: number) => void;

export type MeshweshClient = {
  fetchCollection: (path: string) => Promise<JsonRecord[]>;
  fetchEnemyArmyListIds: (
    armyListIds: readonly string[],
    onArmyFetched?: FetchProgress,
  ) => Promise<Record<string, string[]>>;
  fetchThematicCategoryArmyListIds: (
    thematicCategoryIds: readonly string[],
    onCategoryFetched?: FetchProgress,
  ) => Promise<Record<string, string[]>>;
};

type RequestFailure = { retryable: boolean; message: string };

type RequestResult =
  | { ok: true; body: unknown }
  | { ok: false; failure: RequestFailure };

export const defaultBaseUrl = 'https://meshwesh.wgcwar.com/api/v1';
const defaultConcurrency = 4;
const defaultAttempts = 4;
const defaultRetryDelayMs = 500;

const isRetryableStatus = (status: number) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const requestJson = async (
  url: string,
  fetchImpl: FetchLike,
): Promise<RequestResult> => {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      return {
        ok: false,
        failure: {
          retryable: isRetryableStatus(response.status),
          message: `GET ${url} responded ${response.status} ${response.statusText}`,
        },
      };
    }
    return { ok: true, body: await response.json() };
  } catch (error) {
    return {
      ok: false,
      failure: {
        retryable: true,
        message: `GET ${url} failed: ${describeError(error)}`,
      },
    };
  }
};

const sleepFor = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  const queue = items.entries();
  const worker = async () => {
    for (let next = queue.next(); !next.done; next = queue.next()) {
      const [index, item] = next.value;
      results[index] = await run(item);
    }
  };
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
};

const asRecordArray = (body: unknown, url: string): JsonRecord[] => {
  if (!Array.isArray(body)) {
    throw new Error(`GET ${url} did not return an array`);
  }
  return body.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`GET ${url} returned a non-object at index ${index}`);
    }
    return entry as JsonRecord;
  });
};

export const readRecordIds = (records: readonly JsonRecord[], label: string) =>
  records.map((record, index) => {
    const { id } = record;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`${label}[${index}] has no id`);
    }
    return id;
  });

export const createMeshweshClient = ({
  baseUrl = defaultBaseUrl,
  fetchImpl = (url) => fetch(url),
  sleep = sleepFor,
  concurrency = defaultConcurrency,
  attempts = defaultAttempts,
  retryDelayMs = defaultRetryDelayMs,
}: MeshweshClientOptions = {}): MeshweshClient => {
  const fetchJson = async (path: string) => {
    const url = `${baseUrl}/${path}`;
    let failure: RequestFailure = {
      retryable: false,
      message: `GET ${url} was never attempted`,
    };
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const result = await requestJson(url, fetchImpl);
      if (result.ok) {
        return result.body;
      }
      failure = result.failure;
      if (!failure.retryable || attempt === attempts) {
        break;
      }
      await sleep(retryDelayMs * 2 ** (attempt - 1));
    }
    throw new Error(failure.message);
  };

  const fetchCollection = async (path: string) =>
    asRecordArray(await fetchJson(path), `${baseUrl}/${path}`);

  const fetchRelatedIds = async (
    ownerIds: readonly string[],
    relatedPath: (ownerId: string) => string,
    onFetched?: FetchProgress,
  ) => {
    let fetched = 0;
    const entries = await mapWithConcurrency(
      ownerIds,
      concurrency,
      async (ownerId) => {
        const path = relatedPath(ownerId);
        const related = await fetchCollection(path);
        fetched += 1;
        onFetched?.(fetched, ownerIds.length);
        return [ownerId, readRecordIds(related, path).sort()] as const;
      },
    );
    return Object.fromEntries(entries);
  };

  const fetchEnemyArmyListIds = (
    armyListIds: readonly string[],
    onArmyFetched?: FetchProgress,
  ) =>
    fetchRelatedIds(
      armyListIds,
      (armyListId) => `armyLists/${armyListId}/enemyArmyLists`,
      onArmyFetched,
    );

  const fetchThematicCategoryArmyListIds = (
    thematicCategoryIds: readonly string[],
    onCategoryFetched?: FetchProgress,
  ) =>
    fetchRelatedIds(
      thematicCategoryIds,
      (thematicCategoryId) =>
        `thematicCategories/${thematicCategoryId}/armyLists`,
      onCategoryFetched,
    );

  return {
    fetchCollection,
    fetchEnemyArmyListIds,
    fetchThematicCategoryArmyListIds,
  };
};
