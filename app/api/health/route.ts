import { getDatabase } from '@/lib/db/client';
import { healthResponse } from '@/lib/health/health-response';

export const dynamic = 'force-dynamic';

export const GET = () => healthResponse(getDatabase());
