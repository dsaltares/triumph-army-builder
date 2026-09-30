'use client';

import { anonymousClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { authErrorKey } from './errors.ts';

export const authClient = createAuthClient({
  plugins: [anonymousClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  linkSocial,
  unlinkAccount,
  sendVerificationEmail,
} = authClient;

let minting: Promise<void> | undefined;

const mintAnonymousSession = async () => {
  const { error } = await signIn.anonymous();
  if (error) {
    throw new Error(authErrorKey(error));
  }
};

export const startAnonymousSession = async () => {
  minting ??= mintAnonymousSession().finally(() => {
    minting = undefined;
  });
  await minting;
};
