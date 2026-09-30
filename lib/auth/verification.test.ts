import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { migrateToLatest } from '../db/migrator.ts';
import { verifyAddressSubject } from '../email/templates/verify-address.tsx';
import type { EmailMessage, EmailResult } from '../email/transport.ts';
import { perAddressEmailLimit } from './rate-limit.ts';
import {
  createConfirmationRequestGuard,
  createSendVerificationEmail,
  dailyBudget,
  tooManyConfirmationsCode,
} from './verification.ts';

const url = 'http://localhost:3013/api/auth/verify-email?token=abc123';

const delivered: EmailResult = { delivered: true, id: 'sent' };

const request = (email = 'hannibal@example.test') => ({ user: { email }, url });

// The confirmation reads the locale of the account it is being sent to.
let db: ReturnType<typeof createDatabase>;

beforeAll(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

const recorder = () => {
  const sent: EmailMessage[] = [];
  return {
    sent,
    sendEmail: async (message: EmailMessage) => {
      sent.push(message);
      return delivered;
    },
  };
};

describe('createSendVerificationEmail', () => {
  it('sends the confirmation to the address that asked for it', async () => {
    const { sent, sendEmail } = recorder();

    await createSendVerificationEmail({
      db,
      sendEmail,
    })(request());

    expect(sent).toEqual([
      expect.objectContaining({
        to: 'hannibal@example.test',
        subject: verifyAddressSubject('en'),
      }),
    ]);
  });

  it('carries the link Better Auth minted, untouched', async () => {
    const { sent, sendEmail } = recorder();

    await createSendVerificationEmail({
      db,
      sendEmail,
    })(request());

    expect(sent[0]?.text).toContain(url);
  });

  it('stops at the daily budget rather than spending the Resend quota', async () => {
    const { sent, sendEmail } = recorder();
    const send = createSendVerificationEmail({
      db,
      sendEmail,
    });

    for (let attempt = 0; attempt < dailyBudget.max + 5; attempt++) {
      await send(request(`player-${attempt}@example.test`));
    }

    expect(sent).toHaveLength(dailyBudget.max);
  });

  it('starts the budget again the next day', async () => {
    vi.useFakeTimers();
    const { sent, sendEmail } = recorder();
    const send = createSendVerificationEmail({
      db,
      sendEmail,
    });

    for (let attempt = 0; attempt < dailyBudget.max; attempt++) {
      await send(request(`player-${attempt}@example.test`));
    }
    vi.advanceTimersByTime(dailyBudget.window * 1000);
    await send(request());
    vi.useRealTimers();

    expect(sent).toHaveLength(dailyBudget.max + 1);
  });

  it('never throws at Better Auth when the transport fails', async () => {
    const sendEmail = vi.fn(async () => ({
      delivered: false as const,
      failure: 'unavailable' as const,
      message: 'Resend is down',
    }));

    await expect(
      createSendVerificationEmail({
        db,
        sendEmail,
      })(request()),
    ).resolves.toBeUndefined();
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});

describe('createConfirmationRequestGuard', () => {
  it('refuses an address that has spent its budget, in the confirmation words', async () => {
    const guard = createConfirmationRequestGuard();
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await guard({ email: 'hannibal@example.test' });
    }

    try {
      await guard({ email: 'hannibal@example.test' });
      expect.unreachable('the guard let a fourth request through');
    } catch (error) {
      const refusal = error as {
        statusCode?: number;
        body?: { code?: string };
      };
      expect(refusal.body?.code).toBe(tooManyConfirmationsCode);
      expect(refusal.statusCode).toBe(429);
    }
  });
});
