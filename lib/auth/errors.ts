export const genericAuthKey = 'somethingWentWrong';
export const rateLimitedKey = 'tooManyAttempts';
export const unverifiedAddressKey = 'confirmBeforeSigningIn';
export const expiredResetLinkKey = 'resetLinkExpired';
export const expiredConfirmationLinkKey = 'confirmationLinkExpired';
export const oauthCancelledKey = 'signInCancelled';

const differentAddressKey = 'providerDifferentAddress';
const alreadyLinkedKey = 'providerAlreadyLinked';

const tooManyRequests = 429;

const codeKeys: Record<string, AuthMessageKey> = {
  INVALID_EMAIL_OR_PASSWORD: 'emailPasswordMismatch',
  USER_NOT_FOUND: 'emailPasswordMismatch',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'accountHasNoPassword',
  INVALID_EMAIL: 'notAnEmailAddress',
  INVALID_TOKEN: expiredResetLinkKey,
  EMAIL_NOT_VERIFIED: unverifiedAddressKey,
  SESSION_NOT_FRESH: 'sessionNotFresh',
  SOCIAL_ACCOUNT_ALREADY_LINKED: alreadyLinkedKey,
  LINKING_DIFFERENT_EMAILS_NOT_ALLOWED: differentAddressKey,
  FAILED_TO_UNLINK_LAST_ACCOUNT: 'lastSignInMethod',
  ACCOUNT_NOT_FOUND: 'methodNoLongerConnected',
};

export type AuthMessageKey =
  | 'somethingWentWrong'
  | 'tooManyAttempts'
  | 'confirmBeforeSigningIn'
  | 'resetLinkExpired'
  | 'confirmationLinkExpired'
  | 'signInCancelled'
  | 'providerDifferentAddress'
  | 'providerAlreadyLinked'
  | 'emailPasswordMismatch'
  | 'accountHasNoPassword'
  | 'notAnEmailAddress'
  | 'sessionNotFresh'
  | 'lastSignInMethod'
  | 'methodNoLongerConnected'
  | 'providerGaveNoEmail'
  | 'providerNotLinked';

export type AuthError = {
  code?: string | undefined;
  status?: number | undefined;
};

export const authErrorKey = (error: AuthError | undefined): AuthMessageKey => {
  const known = error?.code ? codeKeys[error.code] : undefined;
  if (known) {
    return known;
  }
  return error?.status === tooManyRequests ? rateLimitedKey : genericAuthKey;
};

const redirectKeys: Record<string, AuthMessageKey> = {
  access_denied: oauthCancelledKey,
  user_cancelled_login: oauthCancelledKey,
  user_cancelled_authorize: oauthCancelledKey,
  email_does_not_match: differentAddressKey,
  account_already_linked_to_different_user: alreadyLinkedKey,
  email_not_found: 'providerGaveNoEmail',
  account_not_linked: 'providerNotLinked',
  TOKEN_EXPIRED: expiredConfirmationLinkKey,
  INVALID_TOKEN: expiredConfirmationLinkKey,
};

export const redirectErrorKey = (
  code: string | null | undefined,
): AuthMessageKey => (code && redirectKeys[code]) || genericAuthKey;
