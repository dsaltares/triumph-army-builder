import { routes } from '../navigation.ts';

export const nextParam = 'next';

export const errorParam = 'error';

const isInternalPath = (path: string) =>
  path.startsWith('/') && !path.startsWith('//');

const authPaths: readonly string[] = [
  routes.signIn,
  routes.signUp,
  routes.forgotPassword,
  routes.resetPassword,
];

const isAuthPath = (path: string) => authPaths.includes(path);

export const afterAuthPath = (next: string | null | undefined) =>
  next && isInternalPath(next) ? next : routes.myArmies;

export const authUrl = (route: string, next?: string | null) =>
  next && isInternalPath(next) && !isAuthPath(next)
    ? `${route}?${nextParam}=${encodeURIComponent(next)}`
    : route;
