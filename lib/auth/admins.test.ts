import { describe, expect, it } from 'vitest';
import { adminEmails, isAdmin } from './admins.ts';

const verified = {
  email: 'hannibal@example.test',
  emailVerified: true,
  isAnonymous: false,
};

describe('adminEmails', () => {
  it('names nobody when ADMIN_EMAILS is unset or blank', () => {
    expect(adminEmails({})).toEqual(new Set());
    expect(adminEmails({ ADMIN_EMAILS: ' , ' })).toEqual(new Set());
  });

  it('reads a comma-separated list, trimmed and lowercased', () => {
    expect(
      adminEmails({
        ADMIN_EMAILS: ' Hannibal@Example.test,scipio@example.test ,',
      }),
    ).toEqual(new Set(['hannibal@example.test', 'scipio@example.test']));
  });

  it('leaves out an entry that is not an email', () => {
    expect(
      adminEmails({ ADMIN_EMAILS: 'hannibal@example.test,carthage' }),
    ).toEqual(new Set(['hannibal@example.test']));
  });
});

describe('isAdmin', () => {
  const admins = adminEmails({ ADMIN_EMAILS: 'hannibal@example.test' });

  it('holds for a verified account on the list, whatever its case', () => {
    expect(isAdmin(verified, admins)).toBe(true);
    expect(
      isAdmin({ ...verified, email: 'HANNIBAL@example.test' }, admins),
    ).toBe(true);
  });

  it('does not hold for an account that is not on the list', () => {
    expect(isAdmin({ ...verified, email: 'scipio@example.test' }, admins)).toBe(
      false,
    );
  });

  it('does not hold for an unverified email on the list', () => {
    expect(isAdmin({ ...verified, emailVerified: false }, admins)).toBe(false);
  });

  it('does not hold for an anonymous session', () => {
    expect(isAdmin({ ...verified, isAnonymous: true }, admins)).toBe(false);
  });
});
