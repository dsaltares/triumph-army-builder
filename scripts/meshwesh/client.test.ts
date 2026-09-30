import { describe, expect, it, vi } from 'vitest';
import { createMeshweshClient, readRecordIds } from './client.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const noSleep = () => Promise.resolve();

describe('createMeshweshClient', () => {
  it('fetches a collection from the base url', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(json([{ id: 'a' }])));
    const client = createMeshweshClient({
      baseUrl: 'https://example.test/api/v1',
      fetchImpl,
      sleep: noSleep,
    });

    await expect(client.fetchCollection('troopTypes')).resolves.toEqual([
      { id: 'a' },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/api/v1/troopTypes',
    );
  });

  it('retries a retryable status and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json([{ id: 'a' }]));
    const sleep = vi.fn(noSleep);
    const client = createMeshweshClient({ fetchImpl, sleep, retryDelayMs: 10 });

    await expect(client.fetchCollection('troopTypes')).resolves.toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it('retries a network failure with exponential backoff', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('socket hang up')));
    const sleep = vi.fn(noSleep);
    const client = createMeshweshClient({
      fetchImpl,
      sleep,
      attempts: 3,
      retryDelayMs: 10,
    });

    await expect(client.fetchCollection('troopTypes')).rejects.toThrow(
      'socket hang up',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it('does not retry a client error', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(json({}, 404)));
    const client = createMeshweshClient({ fetchImpl, sleep: noSleep });

    await expect(client.fetchCollection('nope')).rejects.toThrow(
      'responded 404',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a body that is not an array of objects', async () => {
    const client = createMeshweshClient({
      fetchImpl: () => Promise.resolve(json({ id: 'a' })),
      sleep: noSleep,
    });

    await expect(client.fetchCollection('troopTypes')).rejects.toThrow(
      'did not return an array',
    );
  });

  it('keeps only the enemy ids, sorted, keyed by army list id', async () => {
    const enemies: Record<string, unknown[]> = {
      a: [
        { id: 'c', name: 'C' },
        { id: 'b', name: 'B' },
      ],
      b: [],
    };
    const client = createMeshweshClient({
      baseUrl: 'https://example.test/api/v1',
      sleep: noSleep,
      fetchImpl: (url) => {
        const armyListId = url.split('/').at(-2);
        return Promise.resolve(json(enemies[armyListId ?? ''] ?? []));
      },
    });

    await expect(client.fetchEnemyArmyListIds(['a', 'b'])).resolves.toEqual({
      a: ['b', 'c'],
      b: [],
    });
  });

  it('never runs more enemy requests than the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const client = createMeshweshClient({
      concurrency: 2,
      sleep: noSleep,
      fetchImpl: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return json([]);
      },
    });
    const onArmyFetched = vi.fn();

    await client.fetchEnemyArmyListIds(
      ['a', 'b', 'c', 'd', 'e'],
      onArmyFetched,
    );

    expect(peak).toBe(2);
    expect(onArmyFetched).toHaveBeenCalledTimes(5);
    expect(onArmyFetched).toHaveBeenLastCalledWith(5, 5);
  });

  it('keeps only the army list ids of a thematic category, sorted', async () => {
    const members: Record<string, unknown[]> = {
      k1: [
        { id: 'a2', name: 'Later Sumerian' },
        { id: 'a1', name: 'Goblin Warrens' },
      ],
      k2: [],
    };
    const client = createMeshweshClient({
      baseUrl: 'https://example.test/api/v1',
      sleep: noSleep,
      fetchImpl: (url) => {
        const thematicCategoryId = url.split('/').at(-2);
        return Promise.resolve(json(members[thematicCategoryId ?? ''] ?? []));
      },
    });

    await expect(
      client.fetchThematicCategoryArmyListIds(['k1', 'k2']),
    ).resolves.toEqual({ k1: ['a1', 'a2'], k2: [] });
  });
});

describe('readRecordIds', () => {
  it('reads ids in order', () => {
    expect(readRecordIds([{ id: 'a' }, { id: 'b' }], 'armyLists')).toEqual([
      'a',
      'b',
    ]);
  });

  it('names the collection and index of a record without an id', () => {
    expect(() => readRecordIds([{ id: 'a' }, {}], 'armyLists')).toThrow(
      'armyLists[1] has no id',
    );
  });
});
