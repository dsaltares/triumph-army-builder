'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { maxPasswordLength, minPasswordLength } from '@/lib/auth/credentials';
import {
  anonymousArmyLimit,
  armyNameMaxLength,
} from '@/lib/domain/army/saved-army';
import { anonymousShareLimit } from '@/lib/domain/army/shared-list';
import {
  entryNotesMaxLength,
  entryTagLimit,
  entryTagMaxLength,
} from '@/lib/domain/collection/entry-schema';
import { describeError } from '@/lib/errors';

const values = {
  armyLimit: anonymousArmyLimit,
  shareLimit: anonymousShareLimit,
  max: armyNameMaxLength,
  min: minPasswordLength,
};

const valuesByKey: Record<string, Record<string, number>> = {
  tagTooLong: { max: entryTagMaxLength },
  tooManyTags: { max: entryTagLimit },
  notesTooLong: { max: entryNotesMaxLength },
};

type Loose = {
  (key: string, values: Record<string, number>): string;
  has: (key: string) => boolean;
};

/**
 * Server errors and zod schemas carry a message key, because neither can reach
 * a translator. Anything we do not recognise — a dropped connection, a stray
 * throw — is shown as it came, which is better than a blank.
 */
export function useErrorMessage() {
  const errors = useTranslations('errors') as unknown as Loose;
  const auth = useTranslations('auth') as unknown as Loose;
  return useCallback(
    (error: unknown, details: Record<string, number> = {}) => {
      if (error === undefined || error === null) {
        return undefined;
      }
      const key = describeError(error);
      if (errors.has(key)) {
        return errors(key, { ...values, ...valuesByKey[key], ...details });
      }
      return auth.has(key)
        ? auth(key, { ...values, max: maxPasswordLength })
        : key;
    },
    [errors, auth],
  );
}
