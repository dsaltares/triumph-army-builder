import type { FilterUse } from '@/lib/domain/usage/tracked';
import { sendUsageEvent } from '@/lib/usage/beacon';

export const sendFilterUses = (uses: readonly FilterUse[]) => {
  for (const props of uses) {
    sendUsageEvent({ kind: 'filter.used', props });
  }
};
