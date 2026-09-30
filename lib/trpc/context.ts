import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import {
  type AdminEmails,
  configuredAdminEmails,
  isAdmin,
} from '../auth/admins.ts';
import { type Auth, getAuth } from '../auth/auth.ts';
import { requestOrigin } from '../auth/client-ip.ts';
import { isAnonymousSession } from '../auth/session.ts';
import type { BundleSource } from '../data/bundle-source.ts';
import { bundleFor } from '../data/served-bundle.ts';
import type { EventOrigin } from '../db/activity-events.ts';
import { getDatabase } from '../db/client.ts';
import type { PhotoQuota } from '../db/collection-photos.ts';
import type { Database } from '../db/schema.ts';
import type { IpLookup } from '../geo/lookup.ts';
import type { Locale } from '../i18n/locales.ts';
import { photoQuota as configuredPhotoQuota } from '../photos/limits.ts';
import { createPhotoStore, type PhotoStore } from '../photos/store.ts';

export type Caller = { userId: string; isAnonymous: boolean; isAdmin: boolean };

export type Context = {
  db: Kysely<Database>;
  caller: Caller | null;
  origin: EventOrigin;
  photos: PhotoStore;
  photoQuota: PhotoQuota;
  bundles: (locale: Locale, dataVersion?: string) => BundleSource;
  now: () => string;
  nextId: () => string;
};

export type ContextOptions = {
  headers: Headers;
  db?: Kysely<Database>;
  auth?: Auth;
  admins?: AdminEmails;
  photos?: PhotoStore;
  photoQuota?: PhotoQuota;
  bundles?: (locale: Locale, dataVersion?: string) => BundleSource;
  lookupIp?: IpLookup;
};

export const resolveCaller = async (
  headers: Headers,
  auth: Auth = getAuth(),
  admins: AdminEmails = configuredAdminEmails(),
): Promise<Caller | null> => {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  const isAnonymous = isAnonymousSession(session);
  return {
    userId: session.user.id,
    isAnonymous,
    isAdmin: isAdmin({ ...session.user, isAnonymous }, admins),
  };
};

export const createContext = async ({
  headers,
  db = getDatabase(),
  auth = getAuth(),
  admins = configuredAdminEmails(),
  photos = createPhotoStore(),
  photoQuota = configuredPhotoQuota(),
  bundles = bundleFor,
  lookupIp,
}: ContextOptions): Promise<Context> => ({
  db,
  caller: await resolveCaller(headers, auth, admins),
  origin: requestOrigin(headers, lookupIp),
  photos,
  photoQuota,
  bundles,
  now: () => new Date().toISOString(),
  nextId: () => randomUUID(),
});
