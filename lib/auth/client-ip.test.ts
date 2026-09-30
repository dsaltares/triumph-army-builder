import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp } from './client-ip.ts';

const requestHeaders = (entries: Record<string, string>) =>
  new Headers(entries);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('clientIp', () => {
  it('reads x-forwarded-for when nothing else is configured', () => {
    expect(clientIp(requestHeaders({ 'x-forwarded-for': '81.2.69.142' }))).toBe(
      '81.2.69.142',
    );
  });

  it('reads the headers the deployment names, in order', () => {
    vi.stubEnv('IP_ADDRESS_HEADERS', 'cf-connecting-ip, x-forwarded-for');

    expect(
      clientIp(
        requestHeaders({
          'cf-connecting-ip': '81.2.69.142',
          'x-forwarded-for': '203.0.113.9',
        }),
      ),
    ).toBe('81.2.69.142');
  });

  it('walks a forwarded chain past the proxies it trusts, not to its spoofable left end', () => {
    vi.stubEnv('TRUSTED_PROXIES', '10.0.0.0/8');

    expect(
      clientIp(
        requestHeaders({
          'x-forwarded-for': '198.51.100.7, 81.2.69.142, 10.0.0.2',
        }),
      ),
    ).toBe('81.2.69.142');
  });

  it('keeps the whole of an IPv6 address, where rate limiting collapses it to its /64', () => {
    expect(
      clientIp(requestHeaders({ 'x-forwarded-for': '2a02:26f0:12:34::1' })),
    ).toBe('2a02:26f0:0012:0034:0000:0000:0000:0001');
  });

  it('turns an IPv4-mapped IPv6 address into the IPv4 one', () => {
    expect(
      clientIp(requestHeaders({ 'x-forwarded-for': '::ffff:81.2.69.142' })),
    ).toBe('81.2.69.142');
  });
});
