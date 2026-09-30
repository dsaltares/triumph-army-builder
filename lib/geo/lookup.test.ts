import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeMmdb } from '@/test/mmdb.ts';
import {
  createIpLookup,
  defaultGeoDatabaseDir,
  geoDatabaseDir,
  geoDatabaseFile,
} from './lookup.ts';

const london = { country_code: 'GB', state1: 'England', city: 'London' };

const frankfurt = {
  country_code: 'DE',
  state1: 'Hesse',
  city: 'Frankfurt am Main',
};

const countryOnly = { country_code: 'FR', state1: '', city: '' };

const privateNetworkRecord = {
  country_code: 'US',
  state1: 'California',
  city: 'Nowhere',
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'geo-'));
  await writeMmdb(join(dir, geoDatabaseFile('ipv4')), {
    ipVersion: 4,
    networks: [
      { network: '81.2.69.0/24', record: london },
      { network: '90.0.0.0/8', record: countryOnly },
      { network: '10.0.0.0/8', record: privateNetworkRecord },
      { network: '127.0.0.0/8', record: privateNetworkRecord },
    ],
  });
  await writeMmdb(join(dir, geoDatabaseFile('ipv6')), {
    ipVersion: 6,
    networks: [
      { network: '2a02:26f0::/32', record: frankfurt },
      { network: 'fd00::/8', record: privateNetworkRecord },
      { network: '::1/128', record: privateNetworkRecord },
    ],
  });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createIpLookup', () => {
  it('locates a public IPv4 address', () => {
    expect(createIpLookup(dir)('81.2.69.142')).toEqual({
      country: 'GB',
      region: 'England',
      city: 'London',
    });
  });

  it('locates an IPv6 address, in short or expanded form', () => {
    const lookupIp = createIpLookup(dir);
    const expected = {
      country: 'DE',
      region: 'Hesse',
      city: 'Frankfurt am Main',
    };

    expect(lookupIp('2a02:26f0::1')).toEqual(expected);
    expect(lookupIp('2a02:26f0:0000:0000:0000:0000:0000:0001')).toEqual(
      expected,
    );
  });

  it('leaves out a region and city the database does not know', () => {
    expect(createIpLookup(dir)('90.1.2.3')).toEqual({
      country: 'FR',
      region: null,
      city: null,
    });
  });

  it('returns null for an address the database does not cover', () => {
    const lookupIp = createIpLookup(dir);

    expect(lookupIp('8.8.8.8')).toBeNull();
    expect(lookupIp('2001:db8::1')).toBeNull();
  });

  it.each([
    '10.1.2.3',
    '127.0.0.1',
    '192.168.1.10',
    '::1',
    'fd12:3456::1',
    '::ffff:10.1.2.3',
  ])('returns null for the private or loopback address %s', (ip) => {
    expect(createIpLookup(dir)(ip)).toBeNull();
  });

  it.each(['', 'not an address', '999.1.1.1'])(
    'returns null for %j, which is not an address',
    (ip) => {
      expect(createIpLookup(dir)(ip)).toBeNull();
    },
  );

  it('returns null when the database is missing', () => {
    expect(createIpLookup(join(dir, 'missing'))('81.2.69.142')).toBeNull();
  });

  it('returns null when the database is not an MMDB file', async () => {
    await writeFile(join(dir, geoDatabaseFile('ipv4')), 'not a database');

    const lookupIp = createIpLookup(dir);

    expect(lookupIp('81.2.69.142')).toBeNull();
    expect(lookupIp('2a02:26f0::1')).toEqual({
      country: 'DE',
      region: 'Hesse',
      city: 'Frankfurt am Main',
    });
  });

  it('opens each database once, on its first lookup', async () => {
    const lookupIp = createIpLookup(dir);
    lookupIp('81.2.69.142');

    await rm(join(dir, geoDatabaseFile('ipv4')));

    expect(lookupIp('81.2.69.142')).toMatchObject({ city: 'London' });
  });
});

describe('geoDatabaseDir', () => {
  const previous = process.env.GEO_DATABASE_DIR;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.GEO_DATABASE_DIR;
    } else {
      process.env.GEO_DATABASE_DIR = previous;
    }
  });

  it('is the installed DB-IP package unless GEO_DATABASE_DIR says otherwise', () => {
    delete process.env.GEO_DATABASE_DIR;
    expect(geoDatabaseDir()).toBe(defaultGeoDatabaseDir);

    process.env.GEO_DATABASE_DIR = '/app/geo';
    expect(geoDatabaseDir()).toBe('/app/geo');
  });
});
