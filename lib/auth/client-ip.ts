import { getIP } from 'better-auth/api';
import type { EventOrigin } from '../db/activity-events.ts';
import { type IpLookup, lookupIp } from '../geo/lookup.ts';

const fullAddress = 128;

const listFrom = (value: string | undefined) => {
  const entries = value
    ?.split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return entries?.length ? entries : undefined;
};

export const ipAddressOptions = () => {
  const trustedProxies = listFrom(process.env.TRUSTED_PROXIES);
  const ipAddressHeaders = listFrom(process.env.IP_ADDRESS_HEADERS);
  const options = {
    ...(trustedProxies ? { trustedProxies } : {}),
    ...(ipAddressHeaders ? { ipAddressHeaders } : {}),
  };
  return Object.keys(options).length > 0 ? options : undefined;
};

export const clientIp = (headers: Headers) =>
  getIP(headers, {
    advanced: {
      ipAddress: { ...ipAddressOptions(), ipv6Subnet: fullAddress },
    },
  });

export const requestOrigin = (
  headers: Headers | null | undefined,
  lookup: IpLookup = lookupIp,
): EventOrigin => {
  const ip = headers ? clientIp(headers) : null;
  return { ip, location: ip ? lookup(ip) : null };
};
