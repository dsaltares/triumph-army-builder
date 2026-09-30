import { describe, expect, it } from 'vitest';
import {
  claimCookieName,
  claimedFrom,
  decodeClaimed,
  encodeClaimed,
  expiredClaimCookie,
} from './claim.ts';

const jarWith = (value: string) =>
  `theme=dark; ${claimCookieName}=${value}; other=1`;

describe('the claimed lists cookie', () => {
  it('round-trips the ids that moved', () => {
    const ids = ['army-1', 'army-2'];

    expect(decodeClaimed(encodeClaimed(ids))).toEqual(ids);
  });

  it('reads the ids out of a jar holding other cookies too', () => {
    expect(claimedFrom(jarWith('army-1,army-2'))).toEqual(['army-1', 'army-2']);
  });

  it('reads a value the transport percent-encoded', () => {
    expect(claimedFrom(jarWith(encodeURIComponent('army-1,army-2')))).toEqual([
      'army-1',
      'army-2',
    ]);
  });

  it('finds nothing in a jar without it', () => {
    expect(claimedFrom('theme=dark')).toEqual([]);
    expect(claimedFrom('')).toEqual([]);
  });

  it('finds nothing rather than an empty id in an empty value', () => {
    expect(claimedFrom(jarWith(''))).toEqual([]);
    expect(decodeClaimed(',,')).toEqual([]);
  });

  it('survives a value no encoder of ours wrote', () => {
    expect(claimedFrom(jarWith('%E0%A4%A'))).toEqual([]);
  });

  it('expires itself on the path it was set on', () => {
    expect(expiredClaimCookie()).toContain(`${claimCookieName}=;`);
    expect(expiredClaimCookie()).toContain('Max-Age=0');
    expect(expiredClaimCookie()).toContain('Path=/');
  });
});
