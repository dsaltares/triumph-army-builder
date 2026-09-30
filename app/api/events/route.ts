import { requestOrigin } from '@/lib/auth/client-ip';
import { createRateLimiter, perIpUsageEventLimit } from '@/lib/auth/rate-limit';
import { getDatabase } from '@/lib/db/client';
import { resolveCaller } from '@/lib/trpc/context';
import { recordUsageResponse } from '@/lib/usage/record-usage';

const limiter = createRateLimiter(perIpUsageEventLimit);

export const POST = (request: Request) =>
  recordUsageResponse({
    request,
    caller: () => resolveCaller(request.headers),
    origin: requestOrigin(request.headers),
    db: getDatabase(),
    limiter,
    now: () => new Date().toISOString(),
  });
