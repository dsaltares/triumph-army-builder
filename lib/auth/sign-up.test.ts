import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { migrateToLatest } from '../db/migrator.ts';
import { alreadyRegisteredSubject } from '../email/templates/already-registered.tsx';
import type { EmailMessage } from '../email/transport.ts';
import { createNotifyExistingUser } from './sign-up.ts';

const email = 'hannibal@example.test';

const baseUrl = () => 'https://triumph.example.test';

type NotifyOptions = Omit<
  Parameters<typeof createNotifyExistingUser>[0],
  'sendEmail' | 'db'
>;

// The notice reads the locale of the account that already exists, so the
// sender needs a database even when the test is about the rate limit.
let db: ReturnType<typeof createDatabase>;

beforeAll(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

const notifying = (options: NotifyOptions = {}) => {
  const sent: EmailMessage[] = [];
  const notify = createNotifyExistingUser({
    db,
    baseUrl,
    ...options,
    sendEmail: (message) => {
      sent.push(message);
      return Promise.resolve({ delivered: true, id: `msg_${sent.length}` });
    },
  });
  return { notify, sent };
};

const generous = { window: 3600, max: 100 };

describe('createNotifyExistingUser', () => {
  it('tells the address it already has an account', async () => {
    const { notify, sent } = notifying();

    await notify({ user: { email } });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(email);
    expect(sent[0]?.subject).toBe(alreadyRegisteredSubject('en'));
  });

  it('links the sign-in and reset pages on this site, not a relative path', async () => {
    const { notify, sent } = notifying();

    await notify({ user: { email } });

    expect(sent[0]?.html).toContain('https://triumph.example.test/sign-in');
    expect(sent[0]?.html).toContain(
      'https://triumph.example.test/forgot-password',
    );
  });

  it('keys the per-address budget on the trimmed, lowercased address', async () => {
    const { notify, sent } = notifying({
      perAddress: { window: 3600, max: 1 },
      budget: generous,
    });

    await notify({ user: { email } });
    await notify({ user: { email: ' Hannibal@Example.Test ' } });

    expect(sent).toHaveLength(1);
  });

  it('stops sending once the day’s notice budget is spent', async () => {
    const { notify, sent } = notifying({
      perAddress: generous,
      budget: { window: 86_400, max: 2 },
    });

    await notify({ user: { email: 'one@example.test' } });
    await notify({ user: { email: 'two@example.test' } });
    await notify({ user: { email: 'three@example.test' } });

    expect(sent.map(({ to }) => to)).toEqual([
      'one@example.test',
      'two@example.test',
    ]);
  });

  it('returns quietly when it sends nothing, so the caller learns nothing', async () => {
    const { notify } = notifying({
      perAddress: { window: 3600, max: 1 },
      budget: generous,
    });

    await notify({ user: { email } });

    await expect(notify({ user: { email } })).resolves.toBeUndefined();
  });
});
