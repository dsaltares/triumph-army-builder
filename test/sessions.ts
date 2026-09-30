import type { Kysely } from 'kysely';
import { type Auth, createAuth } from '@/lib/auth/auth.ts';
import type { Database } from '@/lib/db/schema.ts';
import type { EmailMessage } from '@/lib/email/transport.ts';

const password = 'elephants-over-the-alps';

const cookieFrom = (headers: Headers) =>
  new Headers({
    cookie: headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; '),
  });

export const createSessions = (db: Kysely<Database>) => {
  const sent: EmailMessage[] = [];
  const auth: Auth = createAuth({
    db,
    secret: 'a-test-secret-nobody-signs-anything-real-with',
    baseUrl: 'http://localhost:3013',
    limitRequests: false,
    socialProviders: {},
    sendEmail: (message) => {
      sent.push(message);
      return Promise.resolve({ delivered: true, id: `msg_${sent.length}` });
    },
  });

  const confirmationToken = (email: string) => {
    const token = sent.at(-1)?.html.match(/verify-email\?token=([^&"]+)/);
    if (!token?.[1]) {
      throw new Error(`no confirmation email was sent to ${email}`);
    }
    return token[1];
  };

  const signedIn = async (email: string) => {
    await auth.api.signUpEmail({ body: { email, password, name: email } });
    await auth.api.verifyEmail({ query: { token: confirmationToken(email) } });
    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    return cookieFrom(headers);
  };

  const anonymous = async () => {
    const { headers } = await auth.api.signInAnonymous({
      returnHeaders: true,
    });
    return cookieFrom(headers);
  };

  return { auth, signedIn, anonymous };
};
