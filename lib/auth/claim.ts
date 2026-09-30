import { z } from 'zod';

export const claimCookieName = 'triumph.claimed_lists';

export const claimCookieMaxAge = 300;

const separator = ',';

const claimedSchema = z.array(z.string().min(1));

export const encodeClaimed = (ids: readonly string[]) => ids.join(separator);

export const decodeClaimed = (value: string | null | undefined) => {
  const parsed = claimedSchema.safeParse(
    (value ?? '').split(separator).filter(Boolean),
  );
  return parsed.success ? parsed.data : [];
};

const valueIn = (jar: string, name: string) =>
  jar
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const decoded = (value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
};

export const claimedFrom = (jar: string) =>
  decodeClaimed(decoded(valueIn(jar, claimCookieName)));

export const expiredClaimCookie = () =>
  `${claimCookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
