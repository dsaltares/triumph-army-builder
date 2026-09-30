export type AnonymousAware = {
  user: { isAnonymous?: boolean | null | undefined };
};

export const isAnonymousSession = (
  session: AnonymousAware | null | undefined,
) => Boolean(session?.user.isAnonymous);

export const isSignedIn = <Session extends AnonymousAware>(
  session: Session | null | undefined,
): session is Session => !!session && !isAnonymousSession(session);
