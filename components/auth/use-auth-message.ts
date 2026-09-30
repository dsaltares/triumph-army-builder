'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { maxPasswordLength, minPasswordLength } from '@/lib/auth/credentials';

const lengths = { min: minPasswordLength, max: maxPasswordLength };

type Loose = (key: string, values: Record<string, number>) => string;

/**
 * Renders the message keys that `lib/auth/errors.ts` and the credential
 * schemas produce; neither can reach a translator of its own.
 */
export function useAuthMessage() {
  const t = useTranslations('auth') as unknown as Loose;
  return useCallback(
    (key: string | undefined) =>
      key === undefined ? undefined : t(key, lengths),
    [t],
  );
}
