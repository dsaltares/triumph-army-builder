import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loggedId } from './log-transport.ts';
import type { FetchLike } from './resend-transport.ts';
import { createEmailTransport } from './send.ts';
import type { EmailMessage } from './transport.ts';

const message: EmailMessage = {
  to: 'player@triumph.saltares.dev',
  subject: 'Reset your password',
  html: '<p>Reset</p>',
  text: 'Reset',
};

const environment = { ...process.env };

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  process.env = { ...environment };
  vi.unstubAllGlobals();
});

describe('createEmailTransport', () => {
  it('prints the mail when there is no API key', async () => {
    const log = vi.fn();

    await expect(createEmailTransport({ log })(message)).resolves.toEqual({
      delivered: true,
      id: loggedId,
    });
    expect(log.mock.calls[0]?.[0]).toContain('RESEND_API_KEY is not set');
  });

  it('prints the mail when the API key has no sender address', async () => {
    const log = vi.fn();

    await createEmailTransport({ apiKey: 'test-key', log })(message);

    expect(log.mock.calls[0]?.[0]).toContain('EMAIL_FROM is not set');
  });

  it('sends through Resend once both are configured', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchImpl);

    await expect(
      createEmailTransport({
        apiKey: 'test-key',
        from: 'Triumph! Army Builder <noreply@triumph.saltares.dev>',
      })(message),
    ).resolves.toEqual({ delivered: true, id: 'msg_1' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reads the API key and sender address from the environment', async () => {
    process.env.RESEND_API_KEY = 'env-key';
    process.env.EMAIL_FROM =
      'Triumph! Army Builder <noreply@triumph.saltares.dev>';
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'msg_2' }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchImpl);

    await createEmailTransport()(message);

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({ authorization: 'Bearer env-key' });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: 'Triumph! Army Builder <noreply@triumph.saltares.dev>',
    });
  });

  it('never hands a reserved test address to Resend, whatever the environment says', async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn<FetchLike>();
    vi.stubGlobal('fetch', fetchImpl);

    await expect(
      createEmailTransport({
        apiKey: 'a-real-looking-key',
        from: 'Triumph! Army Builder <noreply@triumph.saltares.dev>',
        log,
      })({ ...message, to: 'hannibal-6aac1ad8@example.test' }),
    ).resolves.toEqual({ delivered: true, id: loggedId });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log.mock.calls[0]?.[0]).toContain('reserved address');
  });

  it('still sends to a real address while the key is set', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'msg_3' }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchImpl);

    await expect(
      createEmailTransport({
        apiKey: 'a-real-looking-key',
        from: 'Triumph! Army Builder <noreply@triumph.saltares.dev>',
      })({ ...message, to: 'player@saltares.dev' }),
    ).resolves.toEqual({ delivered: true, id: 'msg_3' });

    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
