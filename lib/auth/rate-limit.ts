import { APIError } from 'better-auth/api';
import { RateLimiterMemory, type RateLimiterRes } from 'rate-limiter-flexible';
import { z } from 'zod';

export type RateLimitRule = {
  window: number;
  max: number;
};

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

export type RateLimiter = {
  consume: (key: string) => Promise<RateLimitVerdict>;
};

export const perAddressEmailLimit: RateLimitRule = { window: 3600, max: 3 };

export const perIpEmailLimit: RateLimitRule = { window: 900, max: 5 };

export const perIpAnonymousLimit: RateLimitRule = { window: 3600, max: 10 };

export const perIpUsageEventLimit: RateLimitRule = { window: 60, max: 30 };

export const perUserPhotoUploadLimit: RateLimitRule = {
  window: 3600,
  max: 60,
};

const isLimitReached = (rejection: unknown): rejection is RateLimiterRes =>
  !(rejection instanceof Error);

const secondsFrom = (ms: number) => Math.max(Math.ceil(ms / 1000), 1);

export const createRateLimiter = ({
  window,
  max,
}: RateLimitRule): RateLimiter => {
  const limiter = new RateLimiterMemory({ points: max, duration: window });

  return {
    consume: async (key) => {
      try {
        await limiter.consume(key);
        return { allowed: true };
      } catch (rejection) {
        if (!isLimitReached(rejection)) {
          throw rejection;
        }
        return {
          allowed: false,
          retryAfter: secondsFrom(rejection.msBeforeNext),
        };
      }
    },
  };
};

const addressBody = z.object({ email: z.string() });

const addressKey = (email: string) => email.trim().toLowerCase();

export type AddressGuardOptions = {
  rule?: RateLimitRule;
  code: string;
  message: string;
};

export const createAddressGuard = ({
  rule = perAddressEmailLimit,
  code,
  message,
}: AddressGuardOptions) => {
  const limiter = createRateLimiter(rule);

  return async (body: unknown) => {
    const parsed = addressBody.safeParse(body);
    if (!parsed.success) {
      return;
    }

    const verdict = await limiter.consume(addressKey(parsed.data.email));
    if (verdict.allowed) {
      return;
    }

    throw new APIError(
      'TOO_MANY_REQUESTS',
      { code, message },
      { 'X-Retry-After': String(verdict.retryAfter) },
    );
  };
};
