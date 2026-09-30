'use server';

import { cookies, headers } from 'next/headers';
import { getLogger } from '../logger.ts';
import { createContext } from '../trpc/context.ts';
import { createCaller } from '../trpc/root.ts';
import {
  type Locale,
  localeCookieMaxAge,
  localeCookieName,
} from './routing.ts';

const logger = getLogger('i18n');

const remember = async (locale: Locale) => {
  const caller = createCaller(
    await createContext({ headers: await headers() }),
  );
  await caller.preferences.setLocale({ locale });
};

export const setLocale = async (locale: Locale) => {
  const jar = await cookies();
  jar.set(localeCookieName, locale, {
    path: '/',
    maxAge: localeCookieMaxAge,
    sameSite: 'lax',
  });

  try {
    await remember(locale);
  } catch (error) {
    logger.info(
      { err: error, locale },
      'Locale kept in this browser only, not on an account',
    );
  }
};
