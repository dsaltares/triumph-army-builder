import { adminRouter } from './routers/admin.ts';
import { armyRouter } from './routers/army.ts';
import { collectionRouter } from './routers/collection.ts';
import { preferencesRouter } from './routers/preferences.ts';
import { referenceRouter } from './routers/reference.ts';
import { shareRouter } from './routers/share.ts';
import { createCallerFactory, router } from './trpc.ts';

export const appRouter = router({
  admin: adminRouter,
  army: armyRouter,
  collection: collectionRouter,
  preferences: preferencesRouter,
  reference: referenceRouter,
  share: shareRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
