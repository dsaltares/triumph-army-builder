import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { migrateToLatest } from '../db/migrator.ts';
import type { EmailResult } from '../email/transport.ts';
import {
  createResetRequestGuard,
  createSendResetPassword,
  tooManyResetRequestsCode,
} from './password-reset.ts';
import { perAddressEmailLimit } from './rate-limit.ts';

const email = 'hannibal@example.test';

const delivered: EmailResult = { delivered: true, id: 'msg_1' };

const withUser = async ({ password }: { password: string | null }) => {
  const db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values({ id: 'user-1', name: 'Hannibal', email, image: null })
    .execute();
  await db
    .insertInto('accounts')
    .values({
      id: 'account-1',
      userId: 'user-1',
      accountId: 'user-1',
      providerId: password ? 'credential' : 'google',
      password,
    })
    .execute();
  return db;
};

const code = (error: unknown) =>
  (error as { body?: { code?: string } }).body?.code;

const statusCode = (error: unknown) =>
  (error as { statusCode?: number }).statusCode;

describe('createSendResetPassword', () => {
  it('sends the reset template to the address that asked', async () => {
    const db = await withUser({ password: 'scrypt:not-a-real-hash' });
    const sendEmail = vi.fn(() => Promise.resolve(delivered));

    await createSendResetPassword({ db, sendEmail })({
      user: { id: 'user-1', email },
      url: 'https://triumph.example.test/reset?token=abc',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        subject: expect.stringContaining('password'),
        html: expect.stringContaining(
          'https://triumph.example.test/reset?token=abc',
        ),
      }),
    );
    await db.destroy();
  });

  it('sends an account with no password the link to set one', async () => {
    const db = await withUser({ password: null });
    const sendEmail = vi.fn(() => Promise.resolve(delivered));

    await createSendResetPassword({ db, sendEmail })({
      user: { id: 'user-1', email },
      url: 'https://triumph.example.test/reset?token=abc',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        subject: 'Set a password for Triumph! Army Builder',
        html: expect.stringContaining(
          'https://triumph.example.test/reset?token=abc',
        ),
      }),
    );
    await db.destroy();
  });
});

describe('createResetRequestGuard', () => {
  it('refuses an address that has spent its budget, in the reset request words', async () => {
    const guard = createResetRequestGuard();
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await guard({ email });
    }

    try {
      await guard({ email });
      expect.unreachable('the guard let a fourth request through');
    } catch (error) {
      expect(code(error)).toBe(tooManyResetRequestsCode);
      expect(statusCode(error)).toBe(429);
    }
  });
});
