import { vi } from 'vitest';

type Outcome = { error?: { code?: string; message?: string; status?: number } };

const succeeds = (): Outcome => ({});

export const signIn = { email: vi.fn(succeeds), social: vi.fn(succeeds) };
export const signUp = { email: vi.fn(succeeds) };
export const signOut = vi.fn(succeeds);
export const requestPasswordReset = vi.fn(succeeds);
export const resetPassword = vi.fn(succeeds);
export const linkSocial = vi.fn(succeeds);
export const unlinkAccount = vi.fn(succeeds);
export const sendVerificationEmail = vi.fn(succeeds);
export const startAnonymousSession = vi.fn(async () => {});

type SessionUser = {
  id: string;
  email: string;
  isAnonymous: boolean;
};

let session: { user: SessionUser } | null = null;

export const asSignedOut = () => {
  session = null;
};

export const asSignedIn = (user: Partial<SessionUser> = {}) => {
  session = {
    user: {
      id: 'user-hannibal',
      email: 'hannibal@example.test',
      isAnonymous: false,
      ...user,
    },
  };
};

export const asAnonymous = (id = 'user-browser') =>
  asSignedIn({
    id,
    email: `${id}@anonymous.placeholder.invalid`,
    isAnonymous: true,
  });

export const useSession = () => ({ data: session, isPending: false });

export const authClient = { signIn, signUp, signOut };
