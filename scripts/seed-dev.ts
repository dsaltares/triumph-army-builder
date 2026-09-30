import { hashPassword } from 'better-auth/crypto';
import { databaseUrl } from '../lib/db/client.ts';
import { devUser, seedDevUser } from '../lib/db/dev-user.ts';

const run = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('yarn db:seed refuses to run with NODE_ENV=production');
  }
  const created = await seedDevUser(hashPassword);
  console.log(
    `${created ? 'Seeded' : 'Already seeded'} ${devUser.email} / ${devUser.password} in ${databaseUrl()}`,
  );
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
