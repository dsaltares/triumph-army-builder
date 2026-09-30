import type { Kysely } from 'kysely';
import { isLocale, type Locale } from '../i18n/routing.ts';
import type { Database } from './schema.ts';

export const readUserLocale = async (
  db: Kysely<Database>,
  userId: string,
): Promise<Locale | null> => {
  const row = await db
    .selectFrom('users')
    .select('locale')
    .where('id', '=', userId)
    .executeTakeFirst();
  return isLocale(row?.locale) ? row.locale : null;
};

export const readUserLocaleByEmail = async (
  db: Kysely<Database>,
  email: string,
): Promise<Locale | null> => {
  const row = await db
    .selectFrom('users')
    .select('locale')
    .where('email', '=', email)
    .executeTakeFirst();
  return isLocale(row?.locale) ? row.locale : null;
};

export const writeUserLocale = async (
  db: Kysely<Database>,
  userId: string,
  locale: Locale,
) => {
  await db
    .updateTable('users')
    .set({ locale })
    .where('id', '=', userId)
    .execute();
};
