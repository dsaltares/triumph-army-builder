import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAddressGuard,
  createRateLimiter,
  perAddressEmailLimit,
} from './rate-limit.ts';

const rule = { window: 60, max: 3 };

const advance = (seconds: number) => vi.advanceTimersByTime(seconds * 1000);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const spend = async (
  limiter: ReturnType<typeof createRateLimiter>,
  key: string,
  times = rule.max,
) => {
  for (let attempt = 0; attempt < times; attempt++) {
    await limiter.consume(key);
  }
};

describe('createRateLimiter', () => {
  it('allows a key up to the maximum in a window', async () => {
    const limiter = createRateLimiter(rule);

    const verdicts = [];
    for (let attempt = 0; attempt < rule.max; attempt++) {
      verdicts.push(await limiter.consume('a'));
    }

    expect(verdicts).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: true },
    ]);
  });

  it('refuses the next one and says how long it has to wait', async () => {
    const limiter = createRateLimiter(rule);
    await spend(limiter, 'a');

    advance(20);

    expect(await limiter.consume('a')).toEqual({
      allowed: false,
      retryAfter: 40,
    });
  });

  it('counts each key on its own', async () => {
    const limiter = createRateLimiter(rule);
    await spend(limiter, 'a');

    expect(await limiter.consume('b')).toEqual({ allowed: true });
  });

  it('starts a fresh window once the first one has run out', async () => {
    const limiter = createRateLimiter(rule);
    await spend(limiter, 'a');

    advance(rule.window);

    expect(await limiter.consume('a')).toEqual({ allowed: true });
  });

  it('measures the window from the first request, not the last', async () => {
    const limiter = createRateLimiter(rule);
    await limiter.consume('a');
    advance(30);
    await limiter.consume('a');
    advance(30);

    expect(await limiter.consume('a')).toEqual({ allowed: true });
    expect(await limiter.consume('a')).toEqual({ allowed: true });
    expect(await limiter.consume('a')).toEqual({ allowed: true });
  });

  it('never promises a wait of zero seconds', async () => {
    const limiter = createRateLimiter(rule);
    await spend(limiter, 'a');

    advance(59.9);

    expect(await limiter.consume('a')).toEqual({
      allowed: false,
      retryAfter: 1,
    });
  });

  it('forgets a key once its window has run out', async () => {
    const limiter = createRateLimiter(rule);
    await limiter.consume('spent');

    advance(rule.window);

    expect(await limiter.consume('spent')).toEqual({ allowed: true });
  });
});

const email = 'hannibal@example.test';

const guarding = () =>
  createAddressGuard({ code: 'TOO_MANY', message: 'Too many.' });

type Refusal = {
  statusCode?: number;
  body?: { code?: string };
  headers?: Record<string, string>;
};

const refusal = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return error as Refusal;
  }
  return undefined;
};

describe('createAddressGuard', () => {
  it('lets an address through until it has spent its budget', async () => {
    const guard = guarding();

    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      expect(await refusal(guard({ email }))).toBeUndefined();
    }

    const refused = await refusal(guard({ email }));
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe('TOO_MANY');
  });

  it('counts an address however it was typed', async () => {
    const guard = guarding();
    await guard({ email: '  Hannibal@Example.Test  ' });
    await guard({ email: 'HANNIBAL@example.test' });
    await guard({ email });

    expect((await refusal(guard({ email })))?.statusCode).toBe(429);
  });

  it('counts one address without spending another address budget', async () => {
    const guard = guarding();
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await guard({ email });
    }

    expect(
      await refusal(guard({ email: 'scipio@example.test' })),
    ).toBeUndefined();
  });

  it('opens up again once the window has passed', async () => {
    const guard = guarding();
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await guard({ email });
    }

    advance(perAddressEmailLimit.window);

    expect(await refusal(guard({ email }))).toBeUndefined();
  });

  it('says how long the caller has to wait', async () => {
    const guard = guarding();
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await guard({ email });
    }

    const refused = await refusal(guard({ email }));

    expect(refused?.headers?.['X-Retry-After']).toBe(
      String(perAddressEmailLimit.window),
    );
  });

  it('leaves a body it cannot read to the endpoint that validates it', async () => {
    const guard = guarding();

    expect(await refusal(guard(undefined))).toBeUndefined();
    expect(await refusal(guard({ address: email }))).toBeUndefined();
  });
});
