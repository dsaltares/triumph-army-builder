// The messages thrown here are keys in the `errors` namespace, not copy: the
// server has no locale and `useErrorMessage` renders them on the client.

import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.ts';

const t = initTRPC.context<Context>().create();

export const router = t.router;

export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const signedInProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.caller) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'signInToKeep',
    });
  }
  return next({ ctx: { ...ctx, caller: ctx.caller } });
});

export const accountProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.caller || ctx.caller.isAnonymous) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'needsAccount',
    });
  }
  return next({ ctx: { ...ctx, caller: ctx.caller } });
});

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.caller?.isAdmin) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'notFound' });
  }
  return next({ ctx: { ...ctx, caller: ctx.caller } });
});
