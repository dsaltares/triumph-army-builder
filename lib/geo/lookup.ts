import { readFileSync } from 'node:fs';
import { BlockList, isIP } from 'node:net';
import { join } from 'node:path';
import { Reader, type Response } from 'maxmind';
import { z } from 'zod';
import { getLogger } from '../logger.ts';

export type IpLocation = {
  country: string;
  region: string | null;
  city: string | null;
};

export type IpLookup = (ip: string) => IpLocation | null;

type Family = 'ipv4' | 'ipv6';

type Readers = Record<Family, () => Reader<Response> | null>;

const logger = getLogger('geo');

export const defaultGeoDatabaseDir = join(
  process.cwd(),
  'node_modules',
  '@ip-location-db',
  'dbip-city-mmdb',
);

export const geoDatabaseDir = () =>
  process.env.GEO_DATABASE_DIR || defaultGeoDatabaseDir;

export const geoDatabaseFile = (family: Family) => `dbip-city-${family}.mmdb`;

const unroutable = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 3],
] as const) {
  unroutable.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 127],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  unroutable.addSubnet(network, prefix, 'ipv6');
}

const dbipRecord = z.object({
  country_code: z.string(),
  state1: z.string().optional(),
  city: z.string().optional(),
});

const orNull = (value: string | undefined) => value || null;

const familyOf = (ip: string): Family | null => {
  const version = isIP(ip);
  return version === 4 ? 'ipv4' : version === 6 ? 'ipv6' : null;
};

const openOnce = (path: string) => {
  let opened: { reader: Reader<Response> | null } | undefined;
  return () => {
    if (!opened) {
      try {
        opened = { reader: new Reader(readFileSync(path)) };
      } catch (error) {
        logger.warn(
          { err: error, path },
          'Geo database unreadable, its lookups return no location',
        );
        opened = { reader: null };
      }
    }
    return opened.reader;
  };
};

const locate = (readers: Readers, ip: string): IpLocation | null => {
  const family = familyOf(ip);
  if (!family || unroutable.check(ip, family)) {
    return null;
  }
  const parsed = dbipRecord.safeParse(readers[family]()?.get(ip));
  if (!parsed.success || !parsed.data.country_code) {
    return null;
  }
  const { country_code, state1, city } = parsed.data;
  return { country: country_code, region: orNull(state1), city: orNull(city) };
};

export const createIpLookup = (dir: string = geoDatabaseDir()): IpLookup => {
  const readers: Readers = {
    ipv4: openOnce(join(dir, geoDatabaseFile('ipv4'))),
    ipv6: openOnce(join(dir, geoDatabaseFile('ipv6'))),
  };
  return (ip) => {
    try {
      return locate(readers, ip);
    } catch (error) {
      logger.warn({ err: error }, 'Geo lookup failed, it returns no location');
      return null;
    }
  };
};

let instance: IpLookup | undefined;

export const lookupIp: IpLookup = (ip) => {
  instance ??= createIpLookup();
  return instance(ip);
};
